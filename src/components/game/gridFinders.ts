/**
 * Grid finder utilities for searching the game grid for specific building types
 * 
 * PERFORMANCE: Uses Set instead of Array for O(1) building type lookups
 */

import { BuildingType, Tile } from '@/types/game';
import { TourWaypoint, TILE_WIDTH, TILE_HEIGHT, PedestrianDestType } from './types';
import { gridToScreen } from './utils';

// PERF: Building type Sets for O(1) lookup instead of O(n) array.includes()
const RESIDENTIAL_BUILDING_TYPES = new Set<BuildingType>([
  'house_small', 'house_medium', 'mansion', 'apartment_low', 'apartment_high'
]);

const SCHOOL_TYPES = new Set<BuildingType>(['school', 'university']);

const COMMERCIAL_TYPES = new Set<BuildingType>([
  'shop_small', 'shop_medium', 'office_low', 'office_high', 'mall'
]);

const INDUSTRIAL_TYPES = new Set<BuildingType>([
  'factory_small', 'factory_medium', 'factory_large', 'warehouse'
]);

const PARK_TYPES = new Set<BuildingType>([
  'park', 'park_large', 'tennis', 'basketball_courts', 'playground_small',
  'playground_large', 'baseball_field_small', 'soccer_field_small',
  'football_field', 'baseball_stadium', 'community_center', 'swimming_pool',
  'skate_park', 'mini_golf_course', 'bleachers_field', 'go_kart_track',
  'amphitheater', 'greenhouse_garden', 'animal_pens_farm', 'cabin_house',
  'campground', 'marina_docks_small', 'pier_large', 'roller_coaster_small',
  'community_garden', 'pond_park', 'park_gate', 'mountain_lodge', 'mountain_trailhead'
]);

// Sports facilities where pedestrians play sports
export const SPORTS_TYPES: BuildingType[] = [
  'basketball_courts', 'tennis', 'soccer_field_small', 'baseball_field_small',
  'football_field', 'baseball_stadium', 'stadium', 'swimming_pool', 'skate_park'
];

// Recreation areas where pedestrians relax
export const RELAXATION_TYPES: BuildingType[] = [
  'park', 'park_large', 'community_garden', 'pond_park', 'greenhouse_garden',
  'amphitheater', 'campground', 'marina_docks_small', 'pier_large'
];

// Active recreation (not sitting)
export const ACTIVE_RECREATION_TYPES: BuildingType[] = [
  'playground_small', 'playground_large', 'mini_golf_course', 'go_kart_track',
  'roller_coaster_small', 'amusement_park', 'mountain_trailhead'
];

// Enterable buildings (pedestrians go inside)
const ENTERABLE_BUILDING_TYPES: BuildingType[] = [
  'shop_small', 'shop_medium', 'office_low', 'office_high', 'mall',
  'school', 'university', 'hospital', 'museum', 'community_center',
  'factory_small', 'factory_medium', 'factory_large', 'warehouse',
  'police_station', 'fire_station', 'city_hall', 'rail_station',
  'subway_station', 'mountain_lodge'
];

// Recreation area types for more specific destination finding
export type RecreationType = 'sports' | 'relaxation' | 'active' | 'general';

export interface RecreationDestination {
  x: number;
  y: number;
  type: RecreationType;
  buildingType: BuildingType;
}

export interface HeliportInfo {
  x: number;
  y: number;
  type: 'hospital' | 'airport' | 'police' | 'mall';
  size: number;
}

export interface DockInfo {
  x: number;
  y: number;
  type: 'marina' | 'pier';
}

export interface PedestrianDestination {
  x: number;
  y: number;
  type: PedestrianDestType;
}

/**
 * Find all residential buildings in the grid
 */
export function findResidentialBuildings(
  grid: Tile[][],
  gridSize: number
): { x: number; y: number }[] {
  if (!grid || gridSize <= 0) return [];

  const residentials: { x: number; y: number }[] = [];
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      if (RESIDENTIAL_BUILDING_TYPES.has(grid[y][x].building.type)) {
        residentials.push({ x, y });
      }
    }
  }
  return residentials;
}

/**
 * Find destinations for pedestrians (schools, commercial, industrial, parks)
 */
export function findPedestrianDestinations(
  grid: Tile[][],
  gridSize: number
): PedestrianDestination[] {
  if (!grid || gridSize <= 0) return [];

  const destinations: PedestrianDestination[] = [];
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const buildingType = grid[y][x].building.type;
      if (SCHOOL_TYPES.has(buildingType)) {
        destinations.push({ x, y, type: 'school' });
      } else if (COMMERCIAL_TYPES.has(buildingType)) {
        destinations.push({ x, y, type: 'commercial' });
      } else if (INDUSTRIAL_TYPES.has(buildingType)) {
        destinations.push({ x, y, type: 'industrial' });
      } else if (PARK_TYPES.has(buildingType)) {
        destinations.push({ x, y, type: 'park' });
      }
    }
  }
  return destinations;
}

/**
 * Find recreation areas with specific type classification
 */
export function findRecreationAreas(
  grid: Tile[][],
  gridSize: number
): RecreationDestination[] {
  if (!grid || gridSize <= 0) return [];

  const destinations: RecreationDestination[] = [];
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const buildingType = grid[y][x].building.type;
      
      if (SPORTS_TYPES.includes(buildingType)) {
        destinations.push({ x, y, type: 'sports', buildingType });
      } else if (RELAXATION_TYPES.includes(buildingType)) {
        destinations.push({ x, y, type: 'relaxation', buildingType });
      } else if (ACTIVE_RECREATION_TYPES.includes(buildingType)) {
        destinations.push({ x, y, type: 'active', buildingType });
      } else if (PARK_TYPES.has(buildingType)) {
        destinations.push({ x, y, type: 'general', buildingType });
      }
    }
  }
  return destinations;
}

/**
 * Find enterable buildings (shops, offices, etc.)
 */
export function findEnterableBuildings(
  grid: Tile[][],
  gridSize: number
): { x: number; y: number; buildingType: BuildingType }[] {
  if (!grid || gridSize <= 0) return [];

  const buildings: { x: number; y: number; buildingType: BuildingType }[] = [];
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const tile = grid[y][x];
      const buildingType = tile.building.type;
      
      // Only include active buildings (powered, not abandoned, construction complete)
      if (
        ENTERABLE_BUILDING_TYPES.includes(buildingType) &&
        tile.building.constructionProgress >= 100 &&
        !tile.building.abandoned
      ) {
        buildings.push({ x, y, buildingType });
      }
    }
  }
  return buildings;
}

/**
 * Check if a building type is a sports facility
 */
export function isSportsFacility(buildingType: BuildingType): boolean {
  return SPORTS_TYPES.includes(buildingType);
}

/**
 * Check if a building type is a relaxation area
 */
export function isRelaxationArea(buildingType: BuildingType): boolean {
  return RELAXATION_TYPES.includes(buildingType);
}

/**
 * Check if a building type is enterable
 */
export function isEnterableBuilding(buildingType: BuildingType): boolean {
  return ENTERABLE_BUILDING_TYPES.includes(buildingType);
}

/**
 * Check if a building type is a park/recreation area
 */
export function isRecreationArea(buildingType: BuildingType): boolean {
  return PARK_TYPES.has(buildingType);
}

/**
 * Find all stations of a specific type (fire or police)
 */
export function findStations(
  grid: Tile[][],
  gridSize: number,
  type: 'fire_station' | 'police_station'
): { x: number; y: number }[] {
  if (!grid || gridSize <= 0) return [];

  const stations: { x: number; y: number }[] = [];
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      if (grid[y][x].building.type === type) {
        stations.push({ x, y });
      }
    }
  }
  return stations;
}

/**
 * Find all active fires in the grid
 */
export function findFires(
  grid: Tile[][],
  gridSize: number
): { x: number; y: number }[] {
  if (!grid || gridSize <= 0) return [];

  const fires: { x: number; y: number }[] = [];
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      if (grid[y][x].building.onFire) {
        fires.push({ x, y });
      }
    }
  }
  return fires;
}

/**
 * Find all airports in the city
 */
export function findAirports(
  grid: Tile[][],
  gridSize: number
): { x: number; y: number }[] {
  if (!grid || gridSize <= 0) return [];

  const airports: { x: number; y: number }[] = [];
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      if (grid[y][x].building.type === 'airport') {
        airports.push({ x, y });
      }
    }
  }
  return airports;
}

/**
 * Find all heliports (hospitals, airports, police stations, and non-dense malls) in the city
 */
export function findHeliports(
  grid: Tile[][],
  gridSize: number
): HeliportInfo[] {
  if (!grid || gridSize <= 0) return [];

  const heliports: HeliportInfo[] = [];
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const buildingType = grid[y][x].building.type;
      if (buildingType === 'hospital') {
        heliports.push({ x, y, type: 'hospital', size: 2 });
      } else if (buildingType === 'airport') {
        heliports.push({ x, y, type: 'airport', size: 4 });
      } else if (buildingType === 'police_station') {
        heliports.push({ x, y, type: 'police', size: 1 });
      } else if (buildingType === 'mall') {
        // Only malls using the basic commercial sprite (not dense variants) can have heliports
        // Dense variants are selected when seed < 50, so we want seed >= 50 (non-dense)
        const seed = (x * 31 + y * 17) % 100;
        if (seed >= 50) {
          heliports.push({ x, y, type: 'mall', size: 3 });
        }
      }
    }
  }
  return heliports;
}

/**
 * Find all marinas and piers in the city (boat spawn/destination points)
 */
export function findMarinasAndPiers(
  grid: Tile[][],
  gridSize: number
): DockInfo[] {
  if (!grid || gridSize <= 0) return [];

  const docks: DockInfo[] = [];
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const buildingType = grid[y][x].building.type;
      if (buildingType === 'marina_docks_small') {
        docks.push({ x, y, type: 'marina' });
      } else if (buildingType === 'pier_large') {
        docks.push({ x, y, type: 'pier' });
      }
    }
  }
  return docks;
}

/**
 * Find marinas that are connected to ocean water (for barge docking)
 * A marina is ocean-connected if it's adjacent to water that touches the map edge
 * Note: Marina is a 2x2 building, so we check all tiles around the entire footprint
 */
export function findOceanConnectedMarinas(
  grid: Tile[][],
  gridSize: number
): DockInfo[] {
  if (!grid || gridSize <= 0) return [];

  // First, find all water tiles that are connected to the edge (ocean water)
  const oceanWaterTiles = new Set<string>();
  const visited = new Set<string>();
  const queue: { x: number; y: number }[] = [];

  // Start BFS from all edge water tiles
  for (let i = 0; i < gridSize; i++) {
    // Check all four edges
    const edgeTiles = [
      { x: 0, y: i },           // West edge
      { x: gridSize - 1, y: i }, // East edge
      { x: i, y: 0 },           // North edge
      { x: i, y: gridSize - 1 }, // South edge
    ];
    
    for (const tile of edgeTiles) {
      if (grid[tile.y][tile.x].building.type === 'water') {
        const key = `${tile.x},${tile.y}`;
        if (!visited.has(key)) {
          queue.push(tile);
          visited.add(key);
        }
      }
    }
  }

  // BFS to find all water connected to edges
  const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  while (queue.length > 0) {
    const { x, y } = queue.shift()!;
    oceanWaterTiles.add(`${x},${y}`);

    for (const [dx, dy] of directions) {
      const nx = x + dx;
      const ny = y + dy;
      const key = `${nx},${ny}`;
      
      if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize && !visited.has(key)) {
        if (grid[ny][nx].building.type === 'water') {
          visited.add(key);
          queue.push({ x: nx, y: ny });
        }
      }
    }
  }

  // Now find marinas adjacent to ocean water
  // Marina is 2x2, so we need to check around the entire footprint
  const oceanMarinas: DockInfo[] = [];

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const buildingType = grid[y][x].building.type;
      if (buildingType === 'marina_docks_small') {
        // Marina is 2x2, check all tiles around the entire 2x2 footprint
        // The origin is at (x, y), so the building occupies (x, y), (x+1, y), (x, y+1), (x+1, y+1)
        let foundOceanWater = false;
        
        // Check all positions around the 2x2 footprint
        const perimeterPositions = [
          // Top edge (above the 2x2)
          { nx: x - 1, ny: y - 1 }, { nx: x, ny: y - 1 }, { nx: x + 1, ny: y - 1 }, { nx: x + 2, ny: y - 1 },
          // Bottom edge (below the 2x2)
          { nx: x - 1, ny: y + 2 }, { nx: x, ny: y + 2 }, { nx: x + 1, ny: y + 2 }, { nx: x + 2, ny: y + 2 },
          // Left edge
          { nx: x - 1, ny: y }, { nx: x - 1, ny: y + 1 },
          // Right edge
          { nx: x + 2, ny: y }, { nx: x + 2, ny: y + 1 },
        ];
        
        for (const pos of perimeterPositions) {
          if (oceanWaterTiles.has(`${pos.nx},${pos.ny}`)) {
            foundOceanWater = true;
            break;
          }
        }
        
        if (foundOceanWater) {
          oceanMarinas.push({ x, y, type: 'marina' });
        }
      }
    }
  }

  return oceanMarinas;
}

export interface OceanSpawnPoint {
  x: number;
  y: number;
  screenX: number;
  screenY: number;
  edge: 'north' | 'south' | 'east' | 'west';
}

/**
 * Find spawn points for barges along ocean edges
 * Returns water tiles at map edges that are part of connected ocean bodies
 */
export function findOceanSpawnPoints(
  grid: Tile[][],
  gridSize: number
): OceanSpawnPoint[] {
  if (!grid || gridSize <= 0) return [];

  const spawnPoints: OceanSpawnPoint[] = [];

  // Check each edge for water tiles
  for (let i = 0; i < gridSize; i++) {
    // West edge (x=0)
    if (grid[i][0].building.type === 'water') {
      const { screenX, screenY } = gridToScreen(0, i, 0, 0);
      spawnPoints.push({
        x: 0,
        y: i,
        screenX: screenX + TILE_WIDTH / 2,
        screenY: screenY + TILE_HEIGHT / 2,
        edge: 'west'
      });
    }
    
    // East edge (x=gridSize-1)
    if (grid[i][gridSize - 1].building.type === 'water') {
      const { screenX, screenY } = gridToScreen(gridSize - 1, i, 0, 0);
      spawnPoints.push({
        x: gridSize - 1,
        y: i,
        screenX: screenX + TILE_WIDTH / 2,
        screenY: screenY + TILE_HEIGHT / 2,
        edge: 'east'
      });
    }
    
    // North edge (y=0)
    if (grid[0][i].building.type === 'water') {
      const { screenX, screenY } = gridToScreen(i, 0, 0, 0);
      spawnPoints.push({
        x: i,
        y: 0,
        screenX: screenX + TILE_WIDTH / 2,
        screenY: screenY + TILE_HEIGHT / 2,
        edge: 'north'
      });
    }
    
    // South edge (y=gridSize-1)
    if (grid[gridSize - 1][i].building.type === 'water') {
      const { screenX, screenY } = gridToScreen(i, gridSize - 1, 0, 0);
      spawnPoints.push({
        x: i,
        y: gridSize - 1,
        screenX: screenX + TILE_WIDTH / 2,
        screenY: screenY + TILE_HEIGHT / 2,
        edge: 'south'
      });
    }
  }

  return spawnPoints;
}

/**
 * Find water tile adjacent to a marina/pier for boat positioning
 */
export function findAdjacentWaterTile(
  grid: Tile[][],
  gridSize: number,
  dockX: number,
  dockY: number
): { x: number; y: number } | null {
  if (!grid || gridSize <= 0) return null;

  // Check adjacent tiles for water (8 directions)
  const directions = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]];
  for (const [dx, dy] of directions) {
    const nx = dockX + dx;
    const ny = dockY + dy;
    if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize) {
      if (grid[ny][nx].building.type === 'water') {
        return { x: nx, y: ny };
      }
    }
  }
  return null;
}

/**
 * Find water tile adjacent to a 2x2 marina for barge docking
 * Checks all tiles around the 2x2 footprint, not just the origin
 */
export function findAdjacentWaterTileForMarina(
  grid: Tile[][],
  gridSize: number,
  marinaX: number,
  marinaY: number
): { x: number; y: number } | null {
  if (!grid || gridSize <= 0) return null;

  // Marina is 2x2, check all tiles around the entire footprint
  // Prioritize tiles directly adjacent to edges (not corners) for better docking visuals
  const perimeterPositions = [
    // Direct edges first (better for docking)
    { nx: marinaX - 1, ny: marinaY },     // Left of top-left
    { nx: marinaX - 1, ny: marinaY + 1 }, // Left of bottom-left
    { nx: marinaX + 2, ny: marinaY },     // Right of top-right
    { nx: marinaX + 2, ny: marinaY + 1 }, // Right of bottom-right
    { nx: marinaX, ny: marinaY - 1 },     // Above top-left
    { nx: marinaX + 1, ny: marinaY - 1 }, // Above top-right
    { nx: marinaX, ny: marinaY + 2 },     // Below bottom-left
    { nx: marinaX + 1, ny: marinaY + 2 }, // Below bottom-right
    // Corners last
    { nx: marinaX - 1, ny: marinaY - 1 }, // Top-left corner
    { nx: marinaX + 2, ny: marinaY - 1 }, // Top-right corner
    { nx: marinaX - 1, ny: marinaY + 2 }, // Bottom-left corner
    { nx: marinaX + 2, ny: marinaY + 2 }, // Bottom-right corner
  ];

  for (const pos of perimeterPositions) {
    if (pos.nx >= 0 && pos.nx < gridSize && pos.ny >= 0 && pos.ny < gridSize) {
      if (grid[pos.ny][pos.nx].building.type === 'water') {
        return { x: pos.nx, y: pos.ny };
      }
    }
  }

  return null;
}

// PERF: Cache Set for firework building types to avoid recreating on each call
let cachedFireworkTypesArray: BuildingType[] | null = null;
let cachedFireworkTypesSet: Set<BuildingType> | null = null;

/**
 * Find all buildings that can have fireworks
 */
export function findFireworkBuildings(
  grid: Tile[][],
  gridSize: number,
  fireworkBuildingTypes: BuildingType[]
): { x: number; y: number; type: BuildingType }[] {
  if (!grid || gridSize <= 0) return [];

  // PERF: Cache the Set conversion - only rebuild if array reference changed
  if (cachedFireworkTypesArray !== fireworkBuildingTypes) {
    cachedFireworkTypesArray = fireworkBuildingTypes;
    cachedFireworkTypesSet = new Set(fireworkBuildingTypes);
  }
  const typesSet = cachedFireworkTypesSet!;

  const buildings: { x: number; y: number; type: BuildingType }[] = [];
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const buildingType = grid[y][x].building.type;
      if (typesSet.has(buildingType)) {
        buildings.push({ x, y, type: buildingType });
      }
    }
  }
  return buildings;
}

/**
 * Find all factories that should emit smog (medium and large, operating)
 */
export function findSmogFactories(
  grid: Tile[][],
  gridSize: number
): { x: number; y: number; type: 'factory_medium' | 'factory_large' }[] {
  if (!grid || gridSize <= 0) return [];

  const factories: { x: number; y: number; type: 'factory_medium' | 'factory_large' }[] = [];
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const tile = grid[y][x];
      const buildingType = tile.building.type;
      // Only include operating factories (powered, not abandoned, not under construction)
      if (
        (buildingType === 'factory_medium' || buildingType === 'factory_large') &&
        tile.building.powered &&
        !tile.building.abandoned &&
        tile.building.constructionProgress >= 100
      ) {
        factories.push({ x, y, type: buildingType });
      }
    }
  }
  return factories;
}

/**
 * Check if a screen position is over water
 */
export function isOverWater(
  grid: Tile[][],
  gridSize: number,
  screenX: number,
  screenY: number
): boolean {
  if (!grid || gridSize <= 0) return false;

  // Convert screen to tile coordinates
  const tileX = Math.floor(screenX / TILE_WIDTH + screenY / TILE_HEIGHT);
  const tileY = Math.floor(screenY / TILE_HEIGHT - screenX / TILE_WIDTH);

  if (tileX < 0 || tileX >= gridSize || tileY < 0 || tileY >= gridSize) {
    return false;
  }

  return grid[tileY][tileX].building.type === 'water';
}

/**
 * Find all connected water tiles from a starting water tile using BFS
 */
export function findConnectedWaterTiles(
  grid: Tile[][],
  gridSize: number,
  startTileX: number,
  startTileY: number,
  maxTiles: number = 200
): { x: number; y: number }[] {
  if (!grid || gridSize <= 0) return [];

  const visited = new Set<string>();
  const waterTiles: { x: number; y: number }[] = [];
  const queue: { x: number; y: number }[] = [{ x: startTileX, y: startTileY }];

  const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]]; // 4-directional for cleaner water bodies

  while (queue.length > 0 && waterTiles.length < maxTiles) {
    const { x, y } = queue.shift()!;
    const key = `${x},${y}`;

    if (visited.has(key)) continue;
    visited.add(key);

    if (x < 0 || x >= gridSize || y < 0 || y >= gridSize) continue;
    if (grid[y][x].building.type !== 'water') continue;

    waterTiles.push({ x, y });

    for (const [dx, dy] of directions) {
      const nx = x + dx;
      const ny = y + dy;
      if (!visited.has(`${nx},${ny}`)) {
        queue.push({ x: nx, y: ny });
      }
    }
  }

  return waterTiles;
}

/**
 * Generate random tour waypoints within a body of water
 */
export function generateTourWaypoints(
  grid: Tile[][],
  gridSize: number,
  startTileX: number,
  startTileY: number
): TourWaypoint[] {
  // Find all water tiles connected to the starting point
  const waterTiles = findConnectedWaterTiles(grid, gridSize, startTileX, startTileY);

  if (waterTiles.length < 3) return []; // Too small for a tour

  // Determine number of waypoints based on body of water size (2-6 waypoints)
  const numWaypoints = Math.min(6, Math.max(2, Math.floor(waterTiles.length / 10)));

  // Spread waypoints across the water body
  const waypoints: TourWaypoint[] = [];
  const usedIndices = new Set<number>();

  // Sort water tiles by distance from center to get outer tiles first
  const centerX = waterTiles.reduce((sum, t) => sum + t.x, 0) / waterTiles.length;
  const centerY = waterTiles.reduce((sum, t) => sum + t.y, 0) / waterTiles.length;

  const tilesWithDist = waterTiles.map((tile, idx) => ({
    ...tile,
    idx,
    distFromCenter: Math.hypot(tile.x - centerX, tile.y - centerY)
  }));

  // Sort by distance from center (outer tiles first), but add randomness
  tilesWithDist.sort((a, b) => (b.distFromCenter - a.distFromCenter) + (Math.random() - 0.5) * 3);

  for (let i = 0; i < numWaypoints && i < tilesWithDist.length; i++) {
    const tile = tilesWithDist[i];

    // Check that this waypoint is reasonably far from previous ones
    let tooClose = false;
    for (const wp of waypoints) {
      const dist = Math.hypot(tile.x - wp.tileX, tile.y - wp.tileY);
      if (dist < 3) {
        tooClose = true;
        break;
      }
    }

    if (!tooClose) {
      const { screenX, screenY } = gridToScreen(tile.x, tile.y, 0, 0);
      waypoints.push({
        screenX: screenX + TILE_WIDTH / 2,
        screenY: screenY + TILE_HEIGHT / 2,
        tileX: tile.x,
        tileY: tile.y
      });
      usedIndices.add(tile.idx);
    }
  }

  // If we didn't get enough waypoints, add some random ones
  while (waypoints.length < numWaypoints && waypoints.length < waterTiles.length) {
    const randomIdx = Math.floor(Math.random() * waterTiles.length);
    if (!usedIndices.has(randomIdx)) {
      const tile = waterTiles[randomIdx];
      const { screenX, screenY } = gridToScreen(tile.x, tile.y, 0, 0);
      waypoints.push({
        screenX: screenX + TILE_WIDTH / 2,
        screenY: screenY + TILE_HEIGHT / 2,
        tileX: tile.x,
        tileY: tile.y
      });
      usedIndices.add(randomIdx);
    }
  }

  return waypoints;
}

/**
 * Bay information for seaplane operations
 */
export interface BayInfo {
  centerX: number; // Tile X of approximate center
  centerY: number; // Tile Y of approximate center
  screenX: number; // Screen X coordinate of center
  screenY: number; // Screen Y coordinate of center
  size: number; // Number of water tiles in the bay
  waterTiles: { x: number; y: number }[]; // All water tiles in this bay
}

/**
 * Find all water bodies (both inland lakes and ocean-connected bays) suitable for seaplane operations
 * Includes both inland water bodies and large ocean-connected areas
 */
export function findBays(
  grid: Tile[][],
  gridSize: number,
  minSize: number = 15
): BayInfo[] {
  if (!grid || gridSize <= 0) return [];

  const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const visitedAll = new Set<string>();
  const bays: BayInfo[] = [];

  // Find ALL connected water bodies (both inland and ocean-connected)
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const key = `${x},${y}`;
      
      // Skip if already visited or not water
      if (visitedAll.has(key) || grid[y][x].building.type !== 'water') {
        continue;
      }

      // BFS to find this water body
      const bayTiles: { x: number; y: number }[] = [];
      const bayQueue: { x: number; y: number }[] = [{ x, y }];
      visitedAll.add(key);

      while (bayQueue.length > 0) {
        const tile = bayQueue.shift()!;
        bayTiles.push(tile);

        for (const [dx, dy] of directions) {
          const nx = tile.x + dx;
          const ny = tile.y + dy;
          const nkey = `${nx},${ny}`;
          
          if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize && !visitedAll.has(nkey)) {
            if (grid[ny][nx].building.type === 'water') {
              visitedAll.add(nkey);
              bayQueue.push({ x: nx, y: ny });
            }
          }
        }
      }

      // Only add if bay is large enough
      if (bayTiles.length >= minSize) {
        // Calculate geometric center of bay
        const geometricCenterX = bayTiles.reduce((sum, t) => sum + t.x, 0) / bayTiles.length;
        const geometricCenterY = bayTiles.reduce((sum, t) => sum + t.y, 0) / bayTiles.length;
        
        // Find the actual water tile closest to the geometric center
        // This ensures the center is always a valid water tile (not land in the middle of a bay)
        let closestTile = bayTiles[0];
        let closestDist = Infinity;
        for (const tile of bayTiles) {
          const dist = Math.hypot(tile.x - geometricCenterX, tile.y - geometricCenterY);
          if (dist < closestDist) {
            closestDist = dist;
            closestTile = tile;
          }
        }
        
        // Convert to screen coordinates using the actual water tile
        const { screenX, screenY } = gridToScreen(closestTile.x, closestTile.y, 0, 0);
        
        bays.push({
          centerX: closestTile.x,
          centerY: closestTile.y,
          screenX: screenX + TILE_WIDTH / 2,
          screenY: screenY + TILE_HEIGHT / 2,
          size: bayTiles.length,
          waterTiles: bayTiles,
        });
      }
    }
  }

  return bays;
}

/**
 * Get a random water tile from a bay for seaplane positioning
 */
export function getRandomBayTile(bay: BayInfo): { x: number; y: number; screenX: number; screenY: number } {
  const tile = bay.waterTiles[Math.floor(Math.random() * bay.waterTiles.length)];
  const { screenX, screenY } = gridToScreen(tile.x, tile.y, 0, 0);
  return {
    x: tile.x,
    y: tile.y,
    screenX: screenX + TILE_WIDTH / 2,
    screenY: screenY + TILE_HEIGHT / 2,
  };
}

/**
 * Calculate total population from the grid (with caching support)
 */
export function calculateTotalPopulation(
  grid: Tile[][],
  gridSize: number
): number {
  if (!grid || gridSize <= 0) return 0;

  let total = 0;
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      total += grid[y][x].building.population || 0;
    }
  }
  return total;
}

/**
 * Count road tiles in the grid (with caching support)
 */
export function countRoadTiles(
  grid: Tile[][],
  gridSize: number
): number {
  if (!grid || gridSize <= 0) return 0;

  let count = 0;
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const type = grid[y][x].building.type;
      if (type === 'road' || type === 'bridge') {
        count++;
      }
    }
  }
  return count;
}
