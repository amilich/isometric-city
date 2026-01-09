// Service coverage calculations and upgrades

import {
  GameState,
  Tile,
  BuildingType,
  ServiceCoverage,
  TOOL_INFO,
} from '@/types/game';

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

// PERF: Optimized service coverage grid creation
// Uses typed arrays internally for faster operations
export function createServiceCoverage(size: number): ServiceCoverage {
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

// Calculate service coverage from service buildings - optimized version
export function calculateServiceCoverage(grid: Tile[][], size: number): ServiceCoverage {
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
