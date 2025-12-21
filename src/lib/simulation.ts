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
  BUILDING_STATS,
  RESIDENTIAL_BUILDINGS,
  COMMERCIAL_BUILDINGS,
  INDUSTRIAL_BUILDINGS,
  CompetitiveState,
  CompetitivePlayer,
  CompetitiveUnit,
  CompetitiveUnitType,
  PlayerId,
} from '@/types/game';
import { generateCityName, generateWaterName } from './names';
import { isMobile } from 'react-device-detect';

// Default grid size for new games
export const DEFAULT_GRID_SIZE = isMobile ? 50 : 70;

// Competitive / RTS mode defaults (kept conservative for perf)
export const COMPETITIVE_GRID_SIZE = isMobile ? 80 : 110;
export const COMPETITIVE_START_MONEY = 2500;

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
        if (grid[0][x].building.type === 'road') return true;
      }
      return false;
    case 'south':
      // Check bottom edge (y = gridSize - 1)
      for (let x = 0; x < gridSize; x++) {
        if (grid[gridSize - 1][x].building.type === 'road') return true;
      }
      return false;
    case 'east':
      // Check right edge (x = gridSize - 1)
      for (let y = 0; y < gridSize; y++) {
        if (grid[y][gridSize - 1].building.type === 'road') return true;
      }
      return false;
    case 'west':
      // Check left edge (x = 0)
      for (let y = 0; y < gridSize; y++) {
        if (grid[y][0].building.type === 'road') return true;
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
    if (checkY < gridSize && grid[checkY]?.[checkX]?.building.type === 'road') {
      roadOnSouthOrEast = true;
      break;
    }
  }
  
  // Check east edge (x + width) - front-left in isometric view
  if (!roadOnSouthOrEast) {
    for (let dy = 0; dy < height; dy++) {
      const checkX = x + width;
      const checkY = y + dy;
      if (checkX < gridSize && grid[checkY]?.[checkX]?.building.type === 'road') {
        roadOnSouthOrEast = true;
        break;
      }
    }
  }
  
  // Check north edge (y - 1) - back-left in isometric view
  for (let dx = 0; dx < width; dx++) {
    const checkX = x + dx;
    const checkY = y - 1;
    if (checkY >= 0 && grid[checkY]?.[checkX]?.building.type === 'road') {
      roadOnNorthOrWest = true;
      break;
    }
  }
  
  // Check west edge (x - 1) - back-right in isometric view
  if (!roadOnNorthOrWest) {
    for (let dy = 0; dy < height; dy++) {
      const checkX = x - 1;
      const checkY = y + dy;
      if (checkX >= 0 && grid[checkY]?.[checkX]?.building.type === 'road') {
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
const NO_CONSTRUCTION_TYPES: BuildingType[] = ['grass', 'empty', 'water', 'road', 'tree'];

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
    gameMode: 'sandbox',
  };
}

function createBooleanGrid(size: number, initial: boolean): boolean[][] {
  const grid: boolean[][] = new Array(size);
  for (let y = 0; y < size; y++) {
    grid[y] = new Array(size).fill(initial);
  }
  return grid;
}

function nextCompetitiveId(state: CompetitiveState): string {
  return `u${state.lastIdCounter + 1}`;
}

function getUnitTemplate(type: CompetitiveUnitType): Omit<CompetitiveUnit, 'id' | 'ownerId' | 'x' | 'y' | 'order'> {
  switch (type) {
    case 'infantry':
      return {
        type,
        hp: 40,
        maxHp: 40,
        speedTilesPerTick: 0.7,
        attackRangeTiles: 1.1,
        attackDamagePerTick: 14,
        igniteChancePerHit: 0.08,
      };
    case 'tank':
      return {
        type,
        hp: 140,
        maxHp: 140,
        speedTilesPerTick: 0.55,
        attackRangeTiles: 2.1,
        attackDamagePerTick: 40,
        igniteChancePerHit: 0.14,
      };
    case 'helicopter':
      return {
        type,
        hp: 110,
        maxHp: 110,
        speedTilesPerTick: 0.95,
        attackRangeTiles: 3.0,
        attackDamagePerTick: 34,
        igniteChancePerHit: 0.18,
      };
  }
}

export function getUnitCost(type: CompetitiveUnitType): number {
  switch (type) {
    case 'infantry':
      return 120;
    case 'tank':
      return 500;
    case 'helicopter':
      return 650;
  }
}

export function createCompetitiveUnit(params: {
  id: string;
  ownerId: PlayerId;
  type: CompetitiveUnitType;
  x: number;
  y: number;
  order?: CompetitiveUnit['order'];
}): CompetitiveUnit {
  const template = getUnitTemplate(params.type);
  return {
    id: params.id,
    ownerId: params.ownerId,
    type: params.type,
    x: params.x,
    y: params.y,
    hp: template.hp,
    maxHp: template.maxHp,
    speedTilesPerTick: template.speedTilesPerTick,
    attackRangeTiles: template.attackRangeTiles,
    attackDamagePerTick: template.attackDamagePerTick,
    igniteChancePerHit: template.igniteChancePerHit,
    order: params.order ?? { kind: 'idle' },
  };
}

function getDefaultBuildingHp(type: BuildingType): number {
  if (type === 'city_hall') return 650;
  if (type === 'water' || type === 'grass' || type === 'tree' || type === 'road' || type === 'rail' || type === 'empty') return 1;
  const size = getBuildingSize(type);
  const area = size.width * size.height;
  const stats = BUILDING_STATS[type];
  const popFactor = stats ? Math.min(200, Math.floor(stats.maxPop / 4)) : 0;
  const jobFactor = stats ? Math.min(200, Math.floor(stats.maxJobs / 6)) : 0;
  return 140 * area + popFactor + jobFactor;
}

function isAttackableBuildingType(type: BuildingType): boolean {
  return !(type === 'water' || type === 'grass' || type === 'tree' || type === 'road' || type === 'rail' || type === 'empty');
}

function nearestOwnerForZonedBuilding(x: number, y: number, players: CompetitivePlayer[]): PlayerId | undefined {
  let best: { id: PlayerId; d2: number } | null = null;
  for (const p of players) {
    if (p.eliminated) continue;
    const dx = (p.base.x + 0.5) - (x + 0.5);
    const dy = (p.base.y + 0.5) - (y + 0.5);
    const d2 = dx * dx + dy * dy;
    if (!best || d2 < best.d2) best = { id: p.id, d2 };
  }
  return best?.id;
}

function revealCircle(
  size: number,
  revealed: boolean[][],
  setRevealed: (x: number, y: number) => void,
  cx: number,
  cy: number,
  radius: number
) {
  const r2 = radius * radius;
  const minX = Math.max(0, Math.floor(cx - radius));
  const maxX = Math.min(size - 1, Math.ceil(cx + radius));
  const minY = Math.max(0, Math.floor(cy - radius));
  const maxY = Math.min(size - 1, Math.ceil(cy + radius));
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2 && !revealed[y][x]) {
        setRevealed(x, y);
      }
    }
  }
}

function canSpawnCityHallAt(grid: Tile[][], size: number, x: number, y: number): boolean {
  const footprint = getBuildingSize('city_hall');
  if (x < 2 || y < 2 || x + footprint.width >= size - 2 || y + footprint.height >= size - 2) return false;
  for (let dy = 0; dy < footprint.height; dy++) {
    for (let dx = 0; dx < footprint.width; dx++) {
      const tile = grid[y + dy]?.[x + dx];
      if (!tile) return false;
      if (tile.building.type === 'water') return false;
      if (tile.building.type !== 'grass' && tile.building.type !== 'tree') return false;
    }
  }
  return true;
}

function placeCompetitiveCityHall(grid: Tile[][], x: number, y: number, ownerId: PlayerId) {
  const b = applyBuildingFootprint(grid, x, y, 'city_hall', 'none', 1);
  b.ownerId = ownerId;
  b.maxHp = getDefaultBuildingHp('city_hall');
  b.hp = b.maxHp;
  b.constructionProgress = 100;
}

function placeStartingRoads(grid: Tile[][], size: number, x: number, y: number) {
  // Light road ring around a 2x2 city hall
  const tiles: Array<{ x: number; y: number }> = [
    { x: x - 1, y }, { x: x - 1, y: y + 1 },
    { x: x + 2, y }, { x: x + 2, y: y + 1 },
    { x, y: y - 1 }, { x: x + 1, y: y - 1 },
    { x, y: y + 2 }, { x: x + 1, y: y + 2 },
  ];
  for (const t of tiles) {
    if (t.x < 0 || t.y < 0 || t.x >= size || t.y >= size) continue;
    const tile = grid[t.y][t.x];
    if (tile.building.type === 'water') continue;
    tile.building = createBuilding('road');
    tile.zone = 'none';
  }
}

function placeOwnedSingleTileBuilding(
  grid: Tile[][],
  size: number,
  x: number,
  y: number,
  type: BuildingType,
  ownerId: PlayerId
) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  const tile = grid[y][x];
  if (tile.building.type === 'water' || tile.building.type === 'empty') return;
  if (tile.building.type !== 'grass' && tile.building.type !== 'tree') return;
  tile.building = createBuilding(type);
  tile.building.ownerId = ownerId;
  tile.building.maxHp = getDefaultBuildingHp(type);
  tile.building.hp = tile.building.maxHp;
  tile.building.constructionProgress = 100;
  tile.zone = 'none';
}

function createCompetitivePlayers(grid: Tile[][], size: number): { players: CompetitivePlayer[]; humanPlayerId: PlayerId } {
  const desired = isMobile ? 3 : 4; // human + (2-3 AI)
  const ids: PlayerId[] = ['p1', 'p2', 'p3', 'p4'].slice(0, desired);
  const colors = ['#60a5fa', '#f97316', '#22c55e', '#e879f9'];
  const names = ['You', 'Orion', 'Helios', 'Atlas'];

  const spawns: Array<{ x: number; y: number }> = [];
  const minDist = Math.floor(size * 0.32);
  const minDist2 = minDist * minDist;

  let attempts = 0;
  while (spawns.length < desired && attempts < 8000) {
    attempts++;
    const x = 3 + Math.floor(Math.random() * (size - 10));
    const y = 3 + Math.floor(Math.random() * (size - 10));
    if (!canSpawnCityHallAt(grid, size, x, y)) continue;
    let ok = true;
    for (const s of spawns) {
      const dx = s.x - x;
      const dy = s.y - y;
      if (dx * dx + dy * dy < minDist2) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    spawns.push({ x, y });
  }

  // Fallback: if terrain is too watery, just pack spawns in corners
  if (spawns.length < desired) {
    spawns.length = 0;
    const fallback = [
      { x: 6, y: 6 },
      { x: size - 10, y: 6 },
      { x: 6, y: size - 10 },
      { x: size - 10, y: size - 10 },
    ];
    for (let i = 0; i < desired; i++) {
      spawns.push(fallback[i]);
    }
  }

  const players: CompetitivePlayer[] = ids.map((id, i) => ({
    id,
    name: names[i] ?? `Player ${i + 1}`,
    color: colors[i] ?? '#94a3b8',
    isHuman: i === 0,
    eliminated: false,
    money: i === 0 ? COMPETITIVE_START_MONEY : COMPETITIVE_START_MONEY + 300,
    score: 0,
    techLevel: 1,
    base: spawns[i],
    ai: i === 0 ? undefined : { nextSpawnTick: 10 + i * 5, nextAttackTick: 40 + i * 15 },
  }));

  return { players, humanPlayerId: players[0].id };
}

export function createCompetitiveGameState(cityName: string = 'Frontier', sizeOverride?: number): GameState {
  const size = sizeOverride ?? COMPETITIVE_GRID_SIZE;
  const { grid, waterBodies } = generateTerrain(size);

  const { players, humanPlayerId } = createCompetitivePlayers(grid, size);
  for (const p of players) {
    placeCompetitiveCityHall(grid, p.base.x, p.base.y, p.id);
    placeStartingRoads(grid, size, p.base.x, p.base.y);
    // Give each city a few owned buildings so attacks feel meaningful beyond just the city hall
    placeOwnedSingleTileBuilding(grid, size, p.base.x - 2, p.base.y + 1, 'house_small', p.id);
    placeOwnedSingleTileBuilding(grid, size, p.base.x + 3, p.base.y + 1, 'house_small', p.id);
    placeOwnedSingleTileBuilding(grid, size, p.base.x + 1, p.base.y - 2, 'shop_small', p.id);
  }

  const fogRevealed = createBooleanGrid(size, false);
  // Reveal around human base (initial scouting vision)
  revealCircle(size, fogRevealed, (x, y) => { fogRevealed[y][x] = true; }, players[0].base.x + 0.5, players[0].base.y + 0.5, 14);

  const competitive: CompetitiveState = {
    humanPlayerId,
    players,
    units: [],
    fog: { revealed: fogRevealed },
    lastIdCounter: 0,
  };

  // Start with a few infantry for each player
  for (const p of players) {
    const template = getUnitTemplate('infantry');
    for (let i = 0; i < (p.isHuman ? 3 : 2); i++) {
      competitive.lastIdCounter++;
      competitive.units.push({
        id: `u${competitive.lastIdCounter}`,
        ownerId: p.id,
        type: 'infantry',
        x: p.base.x + 0.6 + i * 0.25,
        y: p.base.y + 1.6,
        hp: template.hp,
        maxHp: template.maxHp,
        speedTilesPerTick: template.speedTilesPerTick,
        attackRangeTiles: template.attackRangeTiles,
        attackDamagePerTick: template.attackDamagePerTick,
        igniteChancePerHit: template.igniteChancePerHit,
        order: { kind: 'idle' },
      });
    }
  }

  const base = createInitialGameState(size, cityName);
  // Competitive economy uses the same money field for the human player
  base.stats.money = COMPETITIVE_START_MONEY;

  return {
    ...base,
    gameMode: 'competitive',
    // Competitive games should not start random fires; combat will ignite intentionally.
    disastersEnabled: true,
    adjacentCities: [],
    waterBodies,
    competitive,
  };
}

// Service building configuration - defined once, reused across calls
const SERVICE_CONFIG = {
  police_station: { range: 13, rangeSquared: 169, type: 'police' as const },
  fire_station: { range: 18, rangeSquared: 324, type: 'fire' as const },
  hospital: { range: 12, rangeSquared: 144, type: 'health' as const },
  school: { range: 11, rangeSquared: 121, type: 'education' as const },
  university: { range: 19, rangeSquared: 361, type: 'education' as const },
  power_plant: { range: 15, rangeSquared: 225 },
  water_tower: { range: 12, rangeSquared: 144 },
} as const;

// Building types that provide services
const SERVICE_BUILDING_TYPES = new Set([
  'police_station', 'fire_station', 'hospital', 'school', 'university',
  'power_plant', 'water_tower'
]);

// Calculate service coverage from service buildings - optimized version
function calculateServiceCoverage(grid: Tile[][], size: number): ServiceCoverage {
  const services = createServiceCoverage(size);
  
  // First pass: collect all service building positions (much faster than checking every tile)
  const serviceBuildings: Array<{ x: number; y: number; type: BuildingType }> = [];
  
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
      
      serviceBuildings.push({ x, y, type: buildingType });
    }
  }
  
  // Second pass: apply coverage for each service building
  for (const building of serviceBuildings) {
    const { x, y, type } = building;
    const config = SERVICE_CONFIG[type as keyof typeof SERVICE_CONFIG];
    if (!config) continue;
    
    const range = config.range;
    const rangeSquared = config.rangeSquared;
    
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

      if (neighbor.building.type === 'road') {
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
  if (zone === 'none' || building.type === 'grass' || building.type === 'water' || building.type === 'road') {
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
  const isCompetitive = state.gameMode === 'competitive' && !!state.competitive;
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
      
      // PERF: Roads are static unless bulldozed - skip if no utility update needed
      if (originalBuilding.type === 'road' && !needsPowerWaterUpdate) {
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
            const built = applyBuildingFootprint(newGrid, x, y, candidate, tile.zone, 1, services);
            if (isCompetitive && state.competitive) {
              const ownerId = nearestOwnerForZonedBuilding(x, y, state.competitive.players);
              if (ownerId) {
                built.ownerId = ownerId;
                built.maxHp = getDefaultBuildingHp(candidate as BuildingType);
                built.hp = built.maxHp;
              }
            }
          }
        }
      } else if (tile.zone !== 'none' && tile.building.type !== 'grass') {
        // Evolve existing building - this may modify multiple tiles for multi-tile buildings
        // The evolveBuilding function handles its own row modifications internally
        const evolved = evolveBuilding(newGrid, x, y, services, state.stats.demand);
        newGrid[y][x].building = evolved;
        if (isCompetitive && state.competitive) {
          // Ensure zoned buildings get a sensible owner + HP for combat
          if (evolved.type !== 'grass' && evolved.type !== 'water' && evolved.type !== 'road' && evolved.type !== 'tree' && evolved.type !== 'empty') {
            if (!evolved.ownerId) {
              const ownerId = nearestOwnerForZonedBuilding(x, y, state.competitive.players);
              if (ownerId) evolved.ownerId = ownerId;
            }
            if (evolved.maxHp === undefined || evolved.hp === undefined) {
              evolved.maxHp = getDefaultBuildingHp(evolved.type);
              evolved.hp = evolved.maxHp;
            }
          }
        }
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

      // Random fire start
      if (!isCompetitive && state.disastersEnabled && !tile.building.onFire && 
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

  let competitive = state.competitive;
  if (isCompetitive && competitive) {
    const competitiveState = competitive;
    // Match tick is monotonic based on in-game time
    const matchTick = totalTicks;

    // Update tech levels based on match progression
    const updatedPlayers: CompetitivePlayer[] = competitive.players.map((p) => {
      if (p.eliminated) return p;
      const techLevel: 1 | 2 | 3 = matchTick > 900 ? 3 : matchTick > 320 ? 2 : 1;
      return techLevel === p.techLevel ? p : { ...p, techLevel };
    });

    // Update fog-of-war (human only) incrementally
    const prevRevealed = competitive.fog.revealed;
    const fogRows = prevRevealed.slice();
    const modifiedFogRows = new Set<number>();
    const setRevealed = (x: number, y: number) => {
      if (x < 0 || y < 0 || x >= size || y >= size) return;
      if (prevRevealed[y][x]) return;
      if (!modifiedFogRows.has(y)) {
        fogRows[y] = prevRevealed[y].slice();
        modifiedFogRows.add(y);
      }
      fogRows[y][x] = true;
    };

    const human = updatedPlayers.find(p => p.id === competitiveState.humanPlayerId);
    if (human && !human.eliminated) {
      revealCircle(size, prevRevealed, setRevealed, human.base.x + 0.5, human.base.y + 0.5, 12);
    }
    for (const u of competitiveState.units) {
      if (u.ownerId !== competitiveState.humanPlayerId) continue;
      revealCircle(size, prevRevealed, setRevealed, u.x, u.y, u.type === 'helicopter' ? 9 : 6);
    }

    // Helper: find player by id
    const playerById = new Map<PlayerId, CompetitivePlayer>(updatedPlayers.map(p => [p.id, p]));

    // AI: spawn and order units
    const aiPlayers = updatedPlayers.filter(p => !p.isHuman && !p.eliminated && p.ai);
    let units: CompetitiveUnit[] = competitiveState.units;
    let lastIdCounter = competitive.lastIdCounter;
    const humanBase = human?.base ?? updatedPlayers[0].base;

    const spawnUnitForPlayer = (pid: PlayerId, type: CompetitiveUnitType, spawnX: number, spawnY: number) => {
      const template = getUnitTemplate(type);
      lastIdCounter++;
      units = units.concat([{
        id: `u${lastIdCounter}`,
        ownerId: pid,
        type,
        x: spawnX,
        y: spawnY,
        hp: template.hp,
        maxHp: template.maxHp,
        speedTilesPerTick: template.speedTilesPerTick,
        attackRangeTiles: template.attackRangeTiles,
        attackDamagePerTick: template.attackDamagePerTick,
        igniteChancePerHit: template.igniteChancePerHit,
        order: { kind: 'idle' },
      }]);
    };

    const nextPlayers: CompetitivePlayer[] = updatedPlayers.map((p) => {
      if (p.eliminated || !p.ai) return p;

      let money = p.money;
      // Passive income (AoE-like trickle) scales with tech
      money += p.techLevel === 1 ? 8 : p.techLevel === 2 ? 12 : 16;

      let ai = p.ai;
      if (!ai) return { ...p, money };

      if (matchTick >= ai.nextSpawnTick) {
        const options: CompetitiveUnitType[] =
          p.techLevel === 1 ? ['infantry'] :
          p.techLevel === 2 ? ['infantry', 'tank'] :
          ['infantry', 'tank', 'helicopter'];
        const pick = options[Math.floor(Math.random() * options.length)];
        const cost = getUnitCost(pick);
        if (money >= cost) {
          money -= cost;
          spawnUnitForPlayer(p.id, pick, p.base.x + 0.6, p.base.y + 1.6);
        }
        ai = { ...ai, nextSpawnTick: matchTick + 12 + Math.floor(Math.random() * 8) };
      }

      if (matchTick >= ai.nextAttackTick) {
        // Order half of this player's units to attack the human base
        const myUnits = units.filter(u => u.ownerId === p.id);
        const toSend = myUnits.slice(0, Math.max(1, Math.floor(myUnits.length / 2))).map(u => u.id);
        if (toSend.length > 0) {
          units = units.map(u => toSend.includes(u.id) ? { ...u, order: { kind: 'attack', target: humanBase } } : u);
        }
        ai = { ...ai, nextAttackTick: matchTick + 55 + Math.floor(Math.random() * 35) };
      }

      return { ...p, money, ai };
    });

    // Unit movement + combat
    const updatedUnits: CompetitiveUnit[] = [];
    for (const u of units) {
      const owner = playerById.get(u.ownerId);
      if (!owner || owner.eliminated) continue;

      let unit = u;
      const order = unit.order;
      const target = order.kind === 'move' || order.kind === 'attack' ? order.target : null;
      const isFlying = unit.type === 'helicopter';

      if (target) {
        const tx = target.x + 0.5;
        const ty = target.y + 0.5;
        const dx = tx - unit.x;
        const dy = ty - unit.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;

        const inRange = order.kind === 'attack' ? dist <= unit.attackRangeTiles : dist <= 0.35;
        if (!inRange) {
          const step = Math.min(unit.speedTilesPerTick, dist);
          const nx = unit.x + (dx / dist) * step;
          const ny = unit.y + (dy / dist) * step;
          if (!isFlying) {
            const checkX = Math.max(0, Math.min(size - 1, Math.floor(nx)));
            const checkY = Math.max(0, Math.min(size - 1, Math.floor(ny)));
            if (state.grid[checkY][checkX].building.type === 'water') {
              unit = { ...unit, order: { kind: 'idle' } };
            } else {
              unit = { ...unit, x: nx, y: ny };
            }
          } else {
            unit = { ...unit, x: nx, y: ny };
          }
        } else if (order.kind === 'attack') {
          const t = state.grid[target.y]?.[target.x];
          if (!t) {
            unit = { ...unit, order: { kind: 'idle' } };
          } else {
            // For multi-tile buildings, always damage the origin tile
            const origin = findBuildingOrigin(newGrid, target.x, target.y, size) ?? {
              originX: target.x,
              originY: target.y,
              buildingType: t.building.type,
            };
            const ox = origin.originX;
            const oy = origin.originY;
            const originTile = state.grid[oy]?.[ox];
            if (!originTile || !isAttackableBuildingType(origin.buildingType)) {
              unit = { ...unit, order: { kind: 'idle' } };
            } else {
              const modTile = getModifiableTile(ox, oy);
              const b = modTile.building;

              // Only attack enemy-controlled buildings
              const targetOwner = b.ownerId;
              if (targetOwner && targetOwner === unit.ownerId) {
                unit = { ...unit, order: { kind: 'idle' } };
              } else {
                if (b.maxHp === undefined || b.hp === undefined) {
                  b.maxHp = getDefaultBuildingHp(b.type);
                  b.hp = b.maxHp;
                }
                b.hp = Math.max(0, (b.hp ?? 0) - unit.attackDamagePerTick);

                if (!b.onFire && Math.random() < unit.igniteChancePerHit) {
                  b.onFire = true;
                  b.fireProgress = 0;
                }

                if ((b.hp ?? 0) <= 0) {
                  // Let the existing fire mechanic "burn down" the building instead of instantly deleting it.
                  // This creates the AoE-style feedback loop: attack → ignite → burn → rubble/grass.
                  b.hp = 1;
                  b.onFire = true;
                  b.fireProgress = Math.max(b.fireProgress ?? 0, 85);
                }
              }
            }
          }
        }
      }

      updatedUnits.push(unit);
    }

    // Elimination check: if a player's city hall is destroyed, they are eliminated
    const eliminatedPlayers: CompetitivePlayer[] = nextPlayers.map((p) => {
      if (p.eliminated) return p;
      const baseTile = newGrid[p.base.y]?.[p.base.x];
      const stillAlive = baseTile?.building.type === 'city_hall';
      return stillAlive ? p : { ...p, eliminated: true };
    });

    const eliminatedIds = new Set(eliminatedPlayers.filter(p => p.eliminated).map(p => p.id));
    const prunedUnits = updatedUnits.filter(u => !eliminatedIds.has(u.ownerId));

    // Scoreboard: money + surviving units + tech bonus
    const scoredPlayers = eliminatedPlayers.map((p) => {
      const money = p.isHuman ? newStats.money : p.money;
      const unitCount = prunedUnits.filter(u => u.ownerId === p.id).length;
      const score = money + unitCount * 40 + (p.techLevel - 1) * 250 + (p.eliminated ? 0 : 600);
      return { ...p, money, score };
    });

    // Human economy: trickle income (small) to enable unit production
    const humanAlive = scoredPlayers.find(p => p.id === competitiveState.humanPlayerId);
    if (humanAlive && !humanAlive.eliminated) {
      newStats.money = Math.max(0, newStats.money + (humanAlive.techLevel === 1 ? 10 : humanAlive.techLevel === 2 ? 14 : 18));
    }

    competitive = {
      ...competitiveState,
      lastIdCounter,
      players: scoredPlayers,
      units: prunedUnits,
      fog: { revealed: fogRows },
    };
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
    competitive,
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
  if (tile.building.type === 'water' || tile.building.type === 'road') return false;
  
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
          if (grid[ny][nx].building.type === 'road') {
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

  // Roads and rail can be combined, but other buildings require clearing first
  if (buildingType && buildingType !== 'road' && buildingType !== 'rail' && tile.building.type === 'road') {
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
  
  // If this tile has an actual building (not empty), check if it's multi-tile
  if (tile.building.type !== 'empty' && tile.building.type !== 'grass' && 
      tile.building.type !== 'water' && tile.building.type !== 'road' && 
      tile.building.type !== 'rail' && tile.building.type !== 'tree') {
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
              checkTile.building.type !== 'rail' &&
              checkTile.building.type !== 'tree') {
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

// Bulldoze a tile (or entire multi-tile building if applicable)
export function bulldozeTile(state: GameState, x: number, y: number): GameState {
  const tile = state.grid[y]?.[x];
  if (!tile) return state;
  if (tile.building.type === 'water') return state;

  const newGrid = state.grid.map(row => row.map(t => ({ ...t, building: { ...t.building } })));
  
  // Check if this tile is part of a multi-tile building
  const origin = findBuildingOrigin(newGrid, x, y, state.gridSize);
  
  if (origin) {
    // Bulldoze the entire multi-tile building
    const size = getBuildingSize(origin.buildingType);
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
      level: type === 'grass' || type === 'empty' || type === 'water' || type === 'road' ? 0 : Math.floor(Math.random() * 3) + 3,
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
        if (grid[y + dy][x + dx].building.type === 'road') return false;
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
          if (checkTile?.building.type === 'road') nearRoad = true;
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
