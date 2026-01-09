// Simulation engine for IsoCity

import {
  GameState,
  Tile,
  Building,
  BuildingType,
  ZoneType,
  BUILDING_STATS,
  RESIDENTIAL_BUILDINGS,
  COMMERCIAL_BUILDINGS,
  INDUSTRIAL_BUILDINGS,
} from '@/types/game';
import { isMobile } from 'react-device-detect';

// Import from refactored modules
import { createBuilding, createTile, getBuildingSize, getConstructionSpeed, isStarterBuilding, canSpawnMultiTileBuilding, applyBuildingFootprint, findBuildingOrigin, evolveBuilding, hasRoadAccess, NO_CONSTRUCTION_TYPES } from './buildings';
import { calculateServiceCoverage } from './services';
import { calculateStats, updateBudgetCosts } from './stats';
import { generateAdvisorMessages } from './advisors';
import { createInitialGameState } from './initialization';

// Default grid size for new games
export const DEFAULT_GRID_SIZE = isMobile ? 50 : 70;

// Re-export functions from refactored modules for backward compatibility
export { createBuilding, createTile, getBuildingSize, getConstructionSpeed, isStarterBuilding, canSpawnMultiTileBuilding, applyBuildingFootprint, findBuildingOrigin, evolveBuilding, hasRoadAccess, placeBuilding, bulldozeTile, NO_CONSTRUCTION_TYPES } from './buildings';
export { calculateServiceCoverage, upgradeServiceBuilding, SERVICE_CONFIG, SERVICE_BUILDING_TYPES, SERVICE_MAX_LEVEL, SERVICE_RANGE_INCREASE_PER_LEVEL, SERVICE_UPGRADE_COST_BASE, createServiceCoverage } from './services';
export { calculateStats, updateBudgetCosts, createInitialBudget, createInitialStats, calculateAverageCoverage } from './stats';
export { generateAdvisorMessages } from './advisors';
export { createInitialGameState, generateAdjacentCities, generateUUID } from './initialization';
export { hasRoadAtEdge, requiresWaterAdjacency, getWaterAdjacency, getRoadAdjacency } from './adjacency';
export { createBridgesOnPath } from './bridges';
export { placeSubway, removeSubway, placeWaterTerraform, placeLandTerraform, expandGrid, shrinkGrid, getDevelopmentBlockers, checkForDiscoverableCities, getConnectableCities } from './grid';
export type { DevelopmentBlocker } from './grid';

// Perlin-like noise for terrain generation (used by generateRandomAdvancedCity)
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

// All terrain generation functions have been moved to terrain.ts
// All building functions have been moved to buildings.ts
// All service functions have been moved to services.ts
// All stats functions have been moved to stats.ts
// All advisor functions have been moved to advisors.ts
// All grid functions have been moved to grid.ts
// All bridge functions have been moved to bridges.ts
// All adjacency functions have been moved to adjacency.ts
// All initialization functions have been moved to initialization.ts

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
