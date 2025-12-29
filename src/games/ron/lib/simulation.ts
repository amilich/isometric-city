/**
 * Rise of Nations - Simulation Engine
 * 
 * Handles game tick simulation including:
 * - Resource gathering
 * - Unit movement and combat
 * - Building construction and production
 * - AI decision making
 */

import { RoNGameState, RoNPlayer, RoNTile } from '../types/game';
import { Age, AGE_ORDER, AGE_REQUIREMENTS, AGE_POPULATION_BONUS } from '../types/ages';
import { Resources, ResourceType, BASE_GATHER_RATES } from '../types/resources';
import { RoNBuilding, RoNBuildingType, BUILDING_STATS, ECONOMIC_BUILDINGS, UNIT_PRODUCTION_BUILDINGS } from '../types/buildings';
import { Unit, UnitType, UnitTask, UNIT_STATS } from '../types/units';
import { runAdvancedAI } from './ai';

// Simulation constants
const CONSTRUCTION_SPEED = 2; // Progress per tick
const PRODUCTION_SPEED = 1.5; // Unit production progress per tick
const UNIT_MOVE_SPEED = 0.1; // Movement per tick (in tiles)
const ATTACK_COOLDOWN = 10; // Ticks between attacks
const RESOURCE_GATHER_RATE = 0.5; // Base gathering per tick per worker

// Border/Territory constants
const CITY_CENTER_RADIUS = 24; // Base territory radius from city centers (3x larger for warring states style)
const ATTRITION_DAMAGE = 0.1; // Damage per tick when in enemy territory
const ATTRITION_TICK_INTERVAL = 20; // Apply attrition every N ticks

// Auto-work constants for idle villagers
const IDLE_AUTO_WORK_THRESHOLD = 20; // Ticks of idle before auto-assigning work
const AUTO_WORK_SEARCH_RADIUS = 6; // Tiles radius to search for nearby work

// City center building types that create territory
const CITY_CENTER_TYPES: RoNBuildingType[] = ['city_center', 'small_city', 'large_city', 'major_city'];

/**
 * City center cache for performance - avoid scanning entire grid repeatedly
 */
type CityCenter = { x: number; y: number; ownerId: string };
let cachedCityCenters: CityCenter[] = [];
let cityCenterCacheVersion = -1;

/**
 * Extract all city centers from the grid (call once per frame/tick, not per tile)
 */
export function extractCityCenters(grid: RoNTile[][], gridSize: number): CityCenter[] {
  const centers: CityCenter[] = [];
  for (let cy = 0; cy < gridSize; cy++) {
    for (let cx = 0; cx < gridSize; cx++) {
      const tile = grid[cy]?.[cx];
      if (!tile?.building) continue;
      
      if (CITY_CENTER_TYPES.includes(tile.building.type as RoNBuildingType) && tile.building.ownerId) {
        centers.push({ x: cx, y: cy, ownerId: tile.building.ownerId });
      }
    }
  }
  return centers;
}

/**
 * Get the territory owner for a specific tile position.
 * Territory is determined by proximity to city centers.
 * Returns the player ID who owns the territory, or null if unclaimed.
 * 
 * PERFORMANCE: Pass pre-computed cityCenters array to avoid O(n²) grid scan per call.
 */
export function getTerritoryOwner(
  grid: RoNTile[][],
  gridSize: number,
  x: number,
  y: number,
  cityCenters?: CityCenter[]
): string | null {
  // Use provided city centers or extract them (fallback for backwards compatibility)
  const centers = cityCenters ?? extractCityCenters(grid, gridSize);
  
  let closestOwner: string | null = null;
  let closestDistance = Infinity;
  
  // Find closest city center
  for (const center of centers) {
    const dist = Math.sqrt((x - center.x) ** 2 + (y - center.y) ** 2);
    
    // Only count if within city center radius
    if (dist <= CITY_CENTER_RADIUS && dist < closestDistance) {
      closestDistance = dist;
      closestOwner = center.ownerId;
    }
  }
  
  return closestOwner;
}

/**
 * Get all city centers for a player
 */
export function getPlayerCityCenters(
  grid: RoNTile[][],
  gridSize: number,
  playerId: string
): { x: number; y: number; type: RoNBuildingType }[] {
  const centers: { x: number; y: number; type: RoNBuildingType }[] = [];
  
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const tile = grid[y]?.[x];
      if (!tile?.building) continue;
      
      if (CITY_CENTER_TYPES.includes(tile.building.type as RoNBuildingType) && 
          tile.building.ownerId === playerId) {
        centers.push({ x, y, type: tile.building.type as RoNBuildingType });
      }
    }
  }
  
  return centers;
}

/**
 * Check if a position is within a player's territory
 */
export function isInPlayerTerritory(
  grid: RoNTile[][],
  gridSize: number,
  x: number,
  y: number,
  playerId: string
): boolean {
  return getTerritoryOwner(grid, gridSize, x, y) === playerId;
}

/**
 * Get the territory radius for display (constant for now, could vary by city type)
 */
export function getCityCenterRadius(): number {
  return CITY_CENTER_RADIUS;
}

/**
 * Check if a tile is passable for unit movement
 * @param isNaval - if true, unit can only move on water; if false, unit can only move on land
 */
/**
 * Check if a tile is occupied by a multi-tile building
 * Buildings are only stored on the origin tile, so we need to search backward
 */
function isTileOccupiedByBuilding(grid: RoNTile[][], gridX: number, gridY: number, gridSize: number): { occupied: boolean; buildingType: string | null } {
  // Check if this tile itself has a building
  const tile = grid[gridY]?.[gridX];
  if (tile?.building) {
    return { occupied: true, buildingType: tile.building.type };
  }

  // Search backwards to find if this tile is part of a larger building
  const maxSize = 4; // Maximum building size to check
  for (let dy = 0; dy < maxSize; dy++) {
    for (let dx = 0; dx < maxSize; dx++) {
      if (dx === 0 && dy === 0) continue; // Already checked this tile
      
      const originX = gridX - dx;
      const originY = gridY - dy;

      if (originX < 0 || originY < 0 || originX >= gridSize || originY >= gridSize) continue;

      const originTile = grid[originY]?.[originX];
      if (!originTile?.building) continue;

      const buildingType = originTile.building.type as RoNBuildingType;
      const stats = BUILDING_STATS[buildingType];
      if (!stats?.size) continue;

      const { width, height } = stats.size;

      // Check if the target position falls within this building's footprint
      if (gridX >= originX && gridX < originX + width &&
          gridY >= originY && gridY < originY + height) {
        return { occupied: true, buildingType };
      }
    }
  }

  return { occupied: false, buildingType: null };
}

function isTilePassable(grid: RoNTile[][], gridX: number, gridY: number, gridSize: number, isNaval: boolean = false): boolean {
  if (gridX < 0 || gridX >= gridSize || gridY < 0 || gridY >= gridSize) return false;

  const tile = grid[gridY]?.[gridX];
  if (!tile) return false;

  // Check if tile is occupied by a building (including multi-tile buildings)
  const buildingCheck = isTileOccupiedByBuilding(grid, gridX, gridY, gridSize);
  
  if (isNaval) {
    // Naval units can ONLY move on water
    if (tile.terrain !== 'water') return false;
    // Buildings on water block naval movement (except docks)
    if (buildingCheck.occupied && buildingCheck.buildingType !== 'dock') return false;
    return true;
  }

  // Land units - water is impassable
  if (tile.terrain === 'water') return false;

  // Forest (trees) is impassable
  if (tile.forestDensity > 0) return false;

  // Metal deposits (mines) are impassable
  if (tile.hasMetalDeposit) return false;

  // Oil deposits are impassable
  if (tile.hasOilDeposit) return false;

  // Buildings are impassable (except roads which can be walked on)
  if (buildingCheck.occupied && buildingCheck.buildingType !== 'road') return false;

  return true;
}

/**
 * Simple A* pathfinding to find a path avoiding obstacles
 * Returns the next step position or null if no path exists
 * @param isNaval - if true, unit can only move on water; if false, unit can only move on land
 */
function findNextStep(
  grid: RoNTile[][],
  gridSize: number,
  startX: number,
  startY: number,
  targetX: number,
  targetY: number,
  isNaval: boolean = false
): { x: number; y: number } | null {
  // If we're already very close, just return target
  const directDist = Math.sqrt((targetX - startX) ** 2 + (targetY - startY) ** 2);
  if (directDist < 0.5) return { x: targetX, y: targetY };

  // Check if direct path is clear (simple raycast)
  const steps = Math.ceil(directDist / 0.5);
  let directPathClear = true;

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const checkX = Math.floor(startX + (targetX - startX) * t);
    const checkY = Math.floor(startY + (targetY - startY) * t);

    if (!isTilePassable(grid, checkX, checkY, gridSize, isNaval)) {
      directPathClear = false;
      break;
    }
  }

  // If direct path is clear, move directly
  if (directPathClear) {
    const dx = targetX - startX;
    const dy = targetY - startY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const stepSize = UNIT_MOVE_SPEED;
    return {
      x: startX + (dx / dist) * stepSize,
      y: startY + (dy / dist) * stepSize,
    };
  }
  
  // Use A* to find path around obstacles
  const startTileX = Math.floor(startX);
  const startTileY = Math.floor(startY);
  const targetTileX = Math.floor(targetX);
  const targetTileY = Math.floor(targetY);
  
  // Simple BFS for finding next tile to move to (limited search)
  const visited = new Set<string>();
  const queue: Array<{ x: number; y: number; path: Array<{ x: number; y: number }> }> = [];
  
  queue.push({ x: startTileX, y: startTileY, path: [] });
  visited.add(`${startTileX},${startTileY}`);
  
  const directions = [
    { dx: 0, dy: -1 }, // North
    { dx: 1, dy: 0 },  // East
    { dx: 0, dy: 1 },  // South
    { dx: -1, dy: 0 }, // West
    { dx: 1, dy: -1 }, // NE
    { dx: 1, dy: 1 },  // SE
    { dx: -1, dy: 1 }, // SW
    { dx: -1, dy: -1 }, // NW
  ];
  
  let iterations = 0;
  const maxIterations = 200; // Limit search to prevent lag
  
  while (queue.length > 0 && iterations < maxIterations) {
    iterations++;
    
    // Sort by distance to target (greedy best-first)
    queue.sort((a, b) => {
      const distA = Math.abs(a.x - targetTileX) + Math.abs(a.y - targetTileY);
      const distB = Math.abs(b.x - targetTileX) + Math.abs(b.y - targetTileY);
      return distA - distB;
    });
    
    const current = queue.shift()!;
    
    // Check if we reached target tile
    if (current.x === targetTileX && current.y === targetTileY) {
      if (current.path.length > 0) {
        // Return first step of the path
        const nextTile = current.path[0];
        return {
          x: nextTile.x + 0.5,
          y: nextTile.y + 0.5,
        };
      }
      return { x: targetX, y: targetY };
    }
    
    // Explore neighbors
    for (const dir of directions) {
      const nx = current.x + dir.dx;
      const ny = current.y + dir.dy;
      const key = `${nx},${ny}`;
      
      if (visited.has(key)) continue;
      
      // Check if this tile is passable (or is the target tile - we can move toward it)
      const isTarget = nx === targetTileX && ny === targetTileY;
      if (!isTarget && !isTilePassable(grid, nx, ny, gridSize, isNaval)) continue;
      
      visited.add(key);
      queue.push({
        x: nx,
        y: ny,
        path: [...current.path, { x: nx, y: ny }],
      });
    }
  }
  
  // No path found - stay in place or try to move to nearest passable tile
  return null;
}

/**
 * Main simulation tick
 */
export function simulateRoNTick(state: RoNGameState): RoNGameState {
  if (state.gameOver) return state;
  
  let newState = { ...state, tick: state.tick + 1 };
  
  // Update each player
  newState = updatePlayers(newState);
  
  // Update buildings (construction, production)
  newState = updateBuildings(newState);
  
  // Update units (movement, gathering, combat)
  newState = updateUnits(newState);
  
  // Run AI for AI players (using advanced utility-based AI)
  newState = runAdvancedAI(newState);
  
  // Check win/lose conditions
  newState = checkVictoryConditions(newState);
  
  return newState;
}

/**
 * Update player resources and rates
 */
function updatePlayers(state: RoNGameState): RoNGameState {
  const newPlayers = state.players.map(player => {
    if (player.isDefeated) return player;
    
    // Calculate resource rates from buildings and workers
    const rates: Resources = { food: 0, wood: 0, metal: 0, gold: 0, knowledge: 0, oil: 0 };
    
    // Count workers at economic buildings
    // Workers count if they have a gather task targeting the building AND aren't moving
    const workerCounts = new Map<string, number>(); // Building position key -> worker count
    
    state.units.forEach(unit => {
      if (unit.ownerId !== player.id) return;
      if (!unit.task || !unit.task.startsWith('gather_')) return;
      if (unit.isMoving) return; // Only count workers who have arrived
      
      const targetPos = unit.taskTarget;
      if (targetPos && typeof targetPos === 'object' && 'x' in targetPos) {
        // Use floor to match building grid position
        const key = `${Math.floor(targetPos.x)},${Math.floor(targetPos.y)}`;
        workerCounts.set(key, (workerCounts.get(key) || 0) + 1);
      }
    });
    
    // Calculate rates from buildings with workers
    state.grid.forEach((row, y) => {
      row.forEach((tile, x) => {
        if (!tile.building || tile.ownerId !== player.id) return;
        
        const building = tile.building;
        if (building.constructionProgress < 100) return; // Not complete
        
        // Use integer key to match worker count lookup
        const key = `${Math.floor(x)},${Math.floor(y)}`;
        const workers = workerCounts.get(key) || 0;
        
        
        // Base production from building type
        switch (building.type) {
          case 'farm':
            rates.food += workers * RESOURCE_GATHER_RATE * 1.5;
            break;
          case 'woodcutters_camp':
          case 'lumber_mill':
            rates.wood += workers * RESOURCE_GATHER_RATE * 1.2;
            break;
          case 'mine':
          case 'smelter':
            rates.metal += workers * RESOURCE_GATHER_RATE;
            break;
          case 'market':
            rates.gold += workers * RESOURCE_GATHER_RATE * 0.8;
            break;
          case 'oil_well':
          case 'refinery':
            if (tile.hasOilDeposit || building.type === 'refinery') {
              rates.oil += workers * RESOURCE_GATHER_RATE * 0.6;
            }
            break;
          case 'library':
          case 'university':
            rates.knowledge += workers * RESOURCE_GATHER_RATE * 0.5;
            break;
          // City centers provide passive gold income (taxation)
          case 'city_center':
            rates.gold += 0.3; // Passive gold from taxes
            break;
          case 'small_city':
            rates.gold += 0.5;
            break;
          case 'large_city':
            rates.gold += 0.8;
            break;
          case 'major_city':
            rates.gold += 1.2;
            break;
        }
      });
    });
    
    // Calculate fishing income from fishing boats at fishing spots
    state.units.forEach(unit => {
      if (unit.ownerId !== player.id) return;
      if (unit.type !== 'fishing_boat') return;
      if (unit.task !== 'gather_fish') return;
      if (unit.isMoving) return; // Only count boats that have arrived
      
      // Check if the boat is at a fishing spot
      const boatX = Math.floor(unit.x);
      const boatY = Math.floor(unit.y);
      const tile = state.grid[boatY]?.[boatX];
      if (tile?.hasFishingSpot) {
        rates.food += RESOURCE_GATHER_RATE * 1.2; // Fishing is good for food
      }
    });
    
    // Apply rates to resources (capped by storage)
    const newResources = { ...player.resources };
    for (const [resource, rate] of Object.entries(rates)) {
      const r = resource as ResourceType;
      newResources[r] = Math.min(
        player.storageLimits[r],
        newResources[r] + rate
      );
    }
    
    // Calculate population cap from age bonus + buildings with providesHousing
    let populationCap = AGE_POPULATION_BONUS[player.age];
    
    // Add housing from buildings
    state.grid.forEach(row => {
      row.forEach(tile => {
        if (!tile.building || tile.ownerId !== player.id) return;
        if (tile.building.constructionProgress < 100) return; // Not complete
        
        const stats = BUILDING_STATS[tile.building.type as RoNBuildingType];
        if (stats?.providesHousing) {
          populationCap += stats.providesHousing;
        }
      });
    });
    
    // Minimum cap of 5
    populationCap = Math.max(5, populationCap);
    
    return {
      ...player,
      resources: newResources,
      resourceRates: rates,
      populationCap,
    };
  });
  
  return { ...state, players: newPlayers };
}

/**
 * Update buildings (construction progress, unit production)
 */
function updateBuildings(state: RoNGameState): RoNGameState {
  let newGrid = state.grid;
  let newUnits = [...state.units];
  let newPlayers = [...state.players];
  
  newGrid = newGrid.map((row, y) =>
    row.map((tile, x) => {
      if (!tile.building) return tile;
      
      const building = tile.building;
      let updatedBuilding = { ...building };
      
      // Construction progress - buildings auto-construct, builders speed it up
      if (building.constructionProgress < 100) {
        // Count builders assigned to this building
        const builderCount = state.units.filter(
          u => u.task === 'build' && 
               u.taskTarget && 
               typeof u.taskTarget === 'object' &&
               'x' in u.taskTarget &&
               u.taskTarget.x === x && 
               u.taskTarget.y === y &&
               !u.isMoving
        ).length;
        
        // Base construction speed + bonus for each builder
        const baseSpeed = CONSTRUCTION_SPEED * 0.5; // Half speed auto-build
        const builderBonus = builderCount * CONSTRUCTION_SPEED;
        
        updatedBuilding.constructionProgress = Math.min(
          100,
          building.constructionProgress + baseSpeed + builderBonus
        );
      }
      
      // Unit production
      if (building.constructionProgress >= 100 && building.queuedUnits.length > 0) {
        const unitType = building.queuedUnits[0] as UnitType;
        const unitStats = UNIT_STATS[unitType];
        
        if (unitStats) {
          updatedBuilding.productionProgress += PRODUCTION_SPEED;
          
          if (updatedBuilding.productionProgress >= unitStats.buildTime) {
            // Get building size for spawn positioning
            const buildingStats = BUILDING_STATS[building.type as RoNBuildingType];
            const buildingWidth = buildingStats?.size?.width || 1;
            const buildingHeight = buildingStats?.size?.height || 1;
            
            // Spawn unit at random position around the bottom/front of the building
            // Spread across the width and slightly in front
            const spawnOffsetX = (Math.random() - 0.5) * (buildingWidth + 1);
            const spawnOffsetY = buildingHeight + 0.3 + Math.random() * 0.6;
            
            const newUnit: Unit = {
              id: `unit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              type: unitType,
              ownerId: building.ownerId,
              x: x + buildingWidth / 2 + spawnOffsetX,
              y: y + spawnOffsetY,
              health: unitStats.health,
              maxHealth: unitStats.health,
              isSelected: false,
              isMoving: false,
              task: 'idle',
              attackCooldown: ATTACK_COOLDOWN, // Initial cooldown before first attack
              lastAttackTime: 0,
              isAttacking: false,
            };
            
            newUnits.push(newUnit);
            
            // Update player population
            newPlayers = newPlayers.map(p => 
              p.id === building.ownerId 
                ? { ...p, population: p.population + 1 }
                : p
            );
            
            // Remove from queue, reset progress
            updatedBuilding.queuedUnits = building.queuedUnits.slice(1);
            updatedBuilding.productionProgress = 0;
          }
        }
      }
      
      return { ...tile, building: updatedBuilding };
    })
  );
  
  return { ...state, grid: newGrid, units: newUnits, players: newPlayers };
}

// Detection range for auto-attack (in tiles)
const AUTO_ATTACK_RANGE = 3;

/**
 * Check if a unit is military (not civilian)
 */
function isMilitaryUnit(unit: Unit): boolean {
  const stats = UNIT_STATS[unit.type];
  return stats?.category !== 'civilian';
}

/**
 * Find nearby enemy units within range
 */
function findNearbyEnemies(
  unit: Unit,
  allUnits: Unit[],
  range: number
): Unit[] {
  const enemies: Unit[] = [];
  
  for (const other of allUnits) {
    // Skip same owner, dead units, and self
    if (other.ownerId === unit.ownerId || other.health <= 0 || other.id === unit.id) continue;
    
    const dist = Math.sqrt((other.x - unit.x) ** 2 + (other.y - unit.y) ** 2);
    if (dist <= range) {
      enemies.push(other);
    }
  }
  
  // Sort by distance, prioritize military over civilians
  return enemies.sort((a, b) => {
    const aIsMilitary = isMilitaryUnit(a);
    const bIsMilitary = isMilitaryUnit(b);
    
    // Prioritize military targets
    if (aIsMilitary && !bIsMilitary) return -1;
    if (!aIsMilitary && bIsMilitary) return 1;
    
    // Then by distance
    const distA = Math.sqrt((a.x - unit.x) ** 2 + (a.y - unit.y) ** 2);
    const distB = Math.sqrt((b.x - unit.x) ** 2 + (b.y - unit.y) ** 2);
    return distA - distB;
  });
}

/**
 * Count workers assigned to a building (including those en route)
 */
function countWorkersAtBuilding(
  units: Unit[],
  buildingX: number,
  buildingY: number,
  ownerId: string
): number {
  let count = 0;
  for (const unit of units) {
    if (unit.ownerId !== ownerId) continue;
    if (!unit.task?.startsWith('gather_')) continue;
    
    const target = unit.taskTarget;
    if (target && typeof target === 'object' && 'x' in target) {
      // Check if targeting this building (allow small tolerance for float positions)
      if (Math.floor(target.x) === buildingX && Math.floor(target.y) === buildingY) {
        count++;
      }
    }
  }
  return count;
}

/**
 * Find nearby fishing spots for fishing boats
 * Prioritizes closer spots
 */
function findNearbyFishingSpot(
  unit: Unit,
  grid: RoNTile[][],
  gridSize: number,
  radius: number
): { x: number; y: number } | null {
  const unitX = Math.floor(unit.x);
  const unitY = Math.floor(unit.y);

  const candidates: { x: number; y: number; dist: number }[] = [];

  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const gx = unitX + dx;
      const gy = unitY + dy;

      if (gx < 0 || gx >= gridSize || gy < 0 || gy >= gridSize) continue;

      const tile = grid[gy]?.[gx];
      if (!tile) continue;
      if (tile.terrain !== 'water') continue;
      if (!tile.hasFishingSpot) continue;

      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > radius) continue;

      candidates.push({ x: gx, y: gy, dist });
    }
  }

  if (candidates.length === 0) return null;

  // Sort by distance and return closest
  candidates.sort((a, b) => a.dist - b.dist);
  return { x: candidates[0].x, y: candidates[0].y };
}

/**
 * Find nearby economic buildings that a citizen can work at
 * Prioritizes buildings with fewer workers, then by distance
 */
function findNearbyEconomicBuilding(
  unit: Unit,
  grid: RoNTile[][],
  gridSize: number,
  radius: number,
  allUnits: Unit[]
): { x: number; y: number; type: RoNBuildingType; task: UnitTask } | null {
  const unitX = Math.floor(unit.x);
  const unitY = Math.floor(unit.y);

  // Collect all valid buildings with their worker counts
  const candidates: { 
    x: number; 
    y: number; 
    type: RoNBuildingType; 
    task: UnitTask; 
    dist: number;
    currentWorkers: number;
    maxWorkers: number;
  }[] = [];

  // Search in a square around the unit
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const gx = unitX + dx;
      const gy = unitY + dy;

      if (gx < 0 || gx >= gridSize || gy < 0 || gy >= gridSize) continue;

      const tile = grid[gy]?.[gx];
      if (!tile?.building) continue;
      if (tile.building.constructionProgress < 100) continue;
      if (tile.ownerId !== unit.ownerId) continue; // Only own buildings

      // Check if this is an economic building
      if (!ECONOMIC_BUILDINGS.includes(tile.building.type)) continue;

      // Check worker capacity
      const buildingStats = BUILDING_STATS[tile.building.type as RoNBuildingType];
      const maxWorkers = buildingStats?.maxWorkers ?? 999;
      const currentWorkers = countWorkersAtBuilding(allUnits, gx, gy, unit.ownerId);
      if (currentWorkers >= maxWorkers) continue; // Building is full

      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > radius) continue; // Circular radius check

      // Determine the task for this building type
      let task: UnitTask = 'idle';
      switch (tile.building.type) {
        case 'farm':
        case 'granary':
          task = 'gather_food';
          break;
        case 'woodcutters_camp':
        case 'lumber_mill':
          task = 'gather_wood';
          break;
        case 'mine':
        case 'smelter':
          task = 'gather_metal';
          break;
        case 'market':
          task = 'gather_gold';
          break;
        case 'oil_well':
        case 'oil_platform':
        case 'refinery':
          task = 'gather_oil';
          break;
        case 'library':
        case 'university':
          task = 'gather_knowledge';
          break;
        default:
          continue; // Not a gatherable building
      }

      candidates.push({ 
        x: gx, 
        y: gy, 
        type: tile.building.type, 
        task, 
        dist,
        currentWorkers,
        maxWorkers
      });
    }
  }

  if (candidates.length === 0) return null;

  // Sort candidates: prioritize buildings with fewer workers, then by distance
  // Buildings with 0 workers get highest priority
  candidates.sort((a, b) => {
    // First priority: prefer buildings with 0 workers
    if (a.currentWorkers === 0 && b.currentWorkers !== 0) return -1;
    if (b.currentWorkers === 0 && a.currentWorkers !== 0) return 1;
    
    // Second priority: prefer buildings with fewer workers (as % of capacity)
    const aFillRatio = a.currentWorkers / a.maxWorkers;
    const bFillRatio = b.currentWorkers / b.maxWorkers;
    if (aFillRatio !== bFillRatio) return aFillRatio - bFillRatio;
    
    // Third priority: prefer closer buildings
    return a.dist - b.dist;
  });

  const best = candidates[0];
  return { x: best.x, y: best.y, type: best.type, task: best.task };
}

/**
 * Update units (movement, combat, gathering)
 */
function updateUnits(state: RoNGameState): RoNGameState {
  const newUnits: Unit[] = [];
  let newGrid = state.grid;
  const originalUnits = state.units;

  for (let unitIndex = 0; unitIndex < originalUnits.length; unitIndex++) {
    const unit = originalUnits[unitIndex];
    let updatedUnit = { ...unit };
    
    // Reset isAttacking flag each tick - will be set true if attack occurs
    updatedUnit.isAttacking = false;
    
    // Track idle time for citizens - auto-assign work if idle too long
    if (updatedUnit.type === 'citizen') {
      const isIdle = updatedUnit.task === 'idle' || updatedUnit.task === undefined;
      
      if (isIdle && !updatedUnit.isMoving) {
        // Set or update idleSince
        if (updatedUnit.idleSince === undefined) {
          updatedUnit.idleSince = state.tick;
        }
        
        // Check if idle long enough to auto-assign work
        const idleDuration = state.tick - updatedUnit.idleSince;
        if (idleDuration >= IDLE_AUTO_WORK_THRESHOLD) {
          // Find nearby economic building to work at
          // Pass newUnits (already processed this tick) + remaining original units for accurate capacity check
          // This ensures that if unit A was just assigned to a building, unit B will see that assignment
          const allCurrentUnits = [...newUnits, ...originalUnits.slice(unitIndex)];
          const nearbyWork = findNearbyEconomicBuilding(
            updatedUnit,
            state.grid,
            state.gridSize,
            AUTO_WORK_SEARCH_RADIUS,
            allCurrentUnits
          );
          
          if (nearbyWork) {
            // Assign to work at this building
            updatedUnit.task = nearbyWork.task;
            updatedUnit.taskTarget = { x: nearbyWork.x, y: nearbyWork.y };
            updatedUnit.targetX = nearbyWork.x;
            updatedUnit.targetY = nearbyWork.y;
            updatedUnit.isMoving = true;
            updatedUnit.idleSince = undefined; // Clear idle tracker
          }
        }
      } else {
        // Not idle - clear the tracker
        updatedUnit.idleSince = undefined;
      }
    }
    
    // Auto-work for fishing boats - find nearby fishing spots
    if (updatedUnit.type === 'fishing_boat') {
      const isIdle = updatedUnit.task === 'idle' || updatedUnit.task === undefined;
      
      if (isIdle && !updatedUnit.isMoving) {
        if (updatedUnit.idleSince === undefined) {
          updatedUnit.idleSince = state.tick;
        }
        
        const idleDuration = state.tick - updatedUnit.idleSince;
        if (idleDuration >= IDLE_AUTO_WORK_THRESHOLD) {
          // Find nearby fishing spot
          const nearbyFishingSpot = findNearbyFishingSpot(
            updatedUnit,
            state.grid,
            state.gridSize,
            AUTO_WORK_SEARCH_RADIUS * 2 // Larger search radius for fishing boats
          );
          
          if (nearbyFishingSpot) {
            updatedUnit.task = 'gather_fish';
            updatedUnit.taskTarget = { x: nearbyFishingSpot.x, y: nearbyFishingSpot.y };
            updatedUnit.targetX = nearbyFishingSpot.x + 0.5;
            updatedUnit.targetY = nearbyFishingSpot.y + 0.5;
            updatedUnit.isMoving = true;
            updatedUnit.idleSince = undefined;
          }
        }
      } else if (updatedUnit.task !== 'gather_fish') {
        updatedUnit.idleSince = undefined;
      }
    }
    
    // Auto-attack for military units: if idle or moving (not already attacking/gathering),
    // check for nearby enemies and engage them
    if (isMilitaryUnit(updatedUnit)) {
      const isIdleOrMoving = updatedUnit.task === 'idle' || 
                             (updatedUnit.task === undefined && !updatedUnit.taskTarget);
      
      if (isIdleOrMoving || (updatedUnit.isMoving && updatedUnit.task !== 'attack')) {
        const nearbyEnemies = findNearbyEnemies(updatedUnit, state.units, AUTO_ATTACK_RANGE);
        
        if (nearbyEnemies.length > 0) {
          const target = nearbyEnemies[0];
          updatedUnit.task = 'attack';
          updatedUnit.taskTarget = target.id;
          updatedUnit.targetX = target.x;
          updatedUnit.targetY = target.y;
          updatedUnit.isMoving = true;
        }
      }
    }
    
    // Movement with pathfinding
    if (updatedUnit.isMoving && updatedUnit.targetX !== undefined && updatedUnit.targetY !== undefined) {
      const dx = updatedUnit.targetX - updatedUnit.x;
      const dy = updatedUnit.targetY - updatedUnit.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      const unitStats = UNIT_STATS[unit.type];
      const speed = (unitStats?.speed || 1) * UNIT_MOVE_SPEED;

      // For gathering tasks, stop when close to the building (not exactly on it)
      const arrivalDist = updatedUnit.task?.startsWith('gather_') ? 1.5 : speed;

      if (dist < arrivalDist) {
        // Arrived - position depends on task type
        const targetPos = updatedUnit.taskTarget && typeof updatedUnit.taskTarget === 'object' && 'x' in updatedUnit.taskTarget
          ? updatedUnit.taskTarget as { x: number; y: number }
          : null;
        
        if (targetPos) {
          const unitIndex = state.units.findIndex(u => u.id === unit.id);
          
          if (updatedUnit.task === 'gather_food') {
            // Farm workers should be ON or around the farm tile
            // Broader spread so workers visibly work the surrounding area
            const angle = Math.random() * Math.PI * 2;
            const spreadDist = 0.3 + Math.random() * 1.2; // 0.3 to 1.5 tiles from center
            updatedUnit.x = targetPos.x + 0.5 + Math.cos(angle) * spreadDist;
            updatedUnit.y = targetPos.y + 0.5 + Math.sin(angle) * spreadDist;
          } else if (updatedUnit.task === 'gather_wood' || updatedUnit.task === 'gather_metal') {
            // Lumber/mine workers spread broadly around resources
            const angle = (unitIndex * 1.2) + Math.random() * 1.5;
            const spreadDist = 1.0 + Math.random() * 1.5; // 1.0 to 2.5 tiles from center
            updatedUnit.x = targetPos.x + Math.cos(angle) * spreadDist;
            updatedUnit.y = targetPos.y + Math.sin(angle) * spreadDist;
          } else if (updatedUnit.task === 'gather_knowledge' || updatedUnit.task === 'gather_gold' || updatedUnit.task === 'gather_oil') {
            // Library/market/oil workers spread around the building
            const angle = Math.random() * Math.PI * 2;
            const spreadDist = 0.4 + Math.random() * 1.0; // 0.4 to 1.4 tiles from center
            updatedUnit.x = targetPos.x + 0.5 + Math.cos(angle) * spreadDist;
            updatedUnit.y = targetPos.y + 0.5 + Math.sin(angle) * spreadDist;
          } else if (updatedUnit.task === 'attack') {
            // Attack - spread around the target
            const angle = (unitIndex * 1.2) + Math.random() * 0.5;
            const spreadDist = 0.8 + Math.random() * 0.4;
            updatedUnit.x = targetPos.x + Math.cos(angle) * spreadDist;
            updatedUnit.y = targetPos.y + Math.sin(angle) * spreadDist;
          } else {
            // Other tasks - broader positioning around target
            const angle = Math.random() * Math.PI * 2;
            const spreadDist = 0.3 + Math.random() * 0.8;
            updatedUnit.x = targetPos.x + 0.5 + Math.cos(angle) * spreadDist;
            updatedUnit.y = targetPos.y + 0.5 + Math.sin(angle) * spreadDist;
          }
        } else {
          updatedUnit.x = updatedUnit.targetX;
          updatedUnit.y = updatedUnit.targetY;
        }
        updatedUnit.isMoving = false;
        updatedUnit.targetX = undefined;
        updatedUnit.targetY = undefined;
      } else {
        // Use pathfinding to avoid obstacles
        // Check if unit is naval (can only move on water)
        const unitStats = UNIT_STATS[updatedUnit.type];
        const isNavalUnit = unitStats?.isNaval === true;
        
        const nextStep = findNextStep(
          state.grid,
          state.gridSize,
          updatedUnit.x,
          updatedUnit.y,
          updatedUnit.targetX,
          updatedUnit.targetY,
          isNavalUnit
        );
        
        if (nextStep) {
          // Move toward the next step
          const stepDx = nextStep.x - updatedUnit.x;
          const stepDy = nextStep.y - updatedUnit.y;
          const stepDist = Math.sqrt(stepDx * stepDx + stepDy * stepDy);
          
          if (stepDist > 0.01) {
            updatedUnit.x += (stepDx / stepDist) * speed;
            updatedUnit.y += (stepDy / stepDist) * speed;
          }
        } else {
          // No path found - stop trying to move
          updatedUnit.isMoving = false;
          updatedUnit.targetX = undefined;
          updatedUnit.targetY = undefined;
        }
      }
    }
    
    // Combat
    if (updatedUnit.task === 'attack' && updatedUnit.taskTarget) {
      updatedUnit.attackCooldown = Math.max(0, updatedUnit.attackCooldown - 1);
      
      if (updatedUnit.attackCooldown === 0) {
        const unitStats = UNIT_STATS[unit.type];
        const attackRange = unitStats?.range || 1;
        
        // Find target
        if (typeof updatedUnit.taskTarget === 'string') {
          // Target is a unit ID
          const targetUnit = state.units.find(u => u.id === updatedUnit.taskTarget);
          if (targetUnit) {
            const dist = Math.sqrt(
              (targetUnit.x - updatedUnit.x) ** 2 + 
              (targetUnit.y - updatedUnit.y) ** 2
            );
            
            if (dist <= attackRange) {
              // Attack!
              const damage = unitStats?.attack || 1;
              const targetIndex = newUnits.findIndex(u => u.id === targetUnit.id);
              if (targetIndex >= 0) {
                newUnits[targetIndex] = {
                  ...newUnits[targetIndex],
                  health: newUnits[targetIndex].health - damage,
                };
              }
              updatedUnit.attackCooldown = ATTACK_COOLDOWN;
              updatedUnit.lastAttackTime = state.tick;
              updatedUnit.isAttacking = true; // Show attack animation
              updatedUnit.isMoving = false; // Stop moving while attacking
            } else {
              // Move toward target - must get in range first
              updatedUnit.targetX = targetUnit.x;
              updatedUnit.targetY = targetUnit.y;
              updatedUnit.isMoving = true;
            }
          }
        } else if ('x' in updatedUnit.taskTarget) {
          // Target is a building position - capture the typed value
          const targetPos = updatedUnit.taskTarget as { x: number; y: number };
          const targetTile = state.grid[Math.floor(targetPos.y)]?.[Math.floor(targetPos.x)];
          if (targetTile?.building) {
            const dist = Math.sqrt(
              (targetPos.x - updatedUnit.x) ** 2 + 
              (targetPos.y - updatedUnit.y) ** 2
            );
            
            if (dist <= attackRange) {
              // Attack building
              const damage = unitStats?.attack || 1;
              const newBuilding = {
                ...targetTile.building,
                health: targetTile.building.health - damage,
              };
              
              // Update grid
              newGrid = newGrid.map((row, gy) =>
                row.map((tile, gx) => {
                  if (gx === Math.floor(targetPos.x) && 
                      gy === Math.floor(targetPos.y)) {
                    if (newBuilding.health <= 0) {
                      return { ...tile, building: null, ownerId: null };
                    }
                    return { ...tile, building: newBuilding };
                  }
                  return tile;
                })
              );
              
              updatedUnit.attackCooldown = ATTACK_COOLDOWN;
              updatedUnit.lastAttackTime = state.tick;
              updatedUnit.isAttacking = true; // Show attack animation
              updatedUnit.isMoving = false; // Stop moving while attacking
            } else {
              // Move toward target - must get in range first
              updatedUnit.targetX = targetPos.x;
              updatedUnit.targetY = targetPos.y;
              updatedUnit.isMoving = true;
            }
          }
        }
      }
    }
    
    // Attrition damage for units in enemy territory
    if (state.tick % ATTRITION_TICK_INTERVAL === 0) {
      const territoryOwner = getTerritoryOwner(state.grid, state.gridSize, Math.floor(updatedUnit.x), Math.floor(updatedUnit.y));
      
      // If in enemy territory (not own territory and not unclaimed)
      if (territoryOwner !== null && territoryOwner !== updatedUnit.ownerId) {
        updatedUnit.health -= ATTRITION_DAMAGE;
      }
    }
    
    // Only add if still alive
    if (updatedUnit.health > 0) {
      newUnits.push(updatedUnit);
    }
  }
  
  return { ...state, units: newUnits, grid: newGrid };
}

/**
 * AI decision making
 */
function runAI(state: RoNGameState): RoNGameState {
  let newState = state;

  for (const player of state.players) {
    if (player.type !== 'ai' || player.isDefeated) continue;

    const difficulty = player.difficulty || 'medium';
    // Increase action chances so AI is more active
    const actionChance = difficulty === 'easy' ? 0.3 : difficulty === 'medium' ? 0.5 : 0.7;

    // Random chance to take an action each tick
    if (Math.random() > actionChance) continue;

    // AI decision priorities - try multiple actions each tick
    const decisions = [
      () => aiAssignIdleWorkers(newState, player), // First assign workers
      () => aiTryTrainUnits(newState, player),     // Then train units
      () => aiTryBuildEconomic(newState, player),  // Build economy
      () => aiTryBuildMilitary(newState, player),  // Build military
      () => aiTryAdvanceAge(newState, player),     // Advance age
      () => aiAttackIfStrong(newState, player, difficulty), // Attack
    ];
    
    // Execute multiple decisions per tick (AI should be more active)
    let actionsPerTick = difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3;
    for (const decision of decisions) {
      if (actionsPerTick <= 0) break;
      const result = decision();
      if (result !== newState) {
        newState = result;
        actionsPerTick--;
      }
    }
  }
  
  return newState;
}

function aiTryAdvanceAge(state: RoNGameState, player: RoNPlayer): RoNGameState {
  const ageIndex = AGE_ORDER.indexOf(player.age);
  if (ageIndex >= AGE_ORDER.length - 1) return state;
  
  const nextAge = AGE_ORDER[ageIndex + 1];
  const requirements = AGE_REQUIREMENTS[nextAge];
  if (!requirements) return state;
  
  // Check if can afford
  for (const [resource, amount] of Object.entries(requirements)) {
    if (player.resources[resource as ResourceType] < amount) {
      return state;
    }
  }
  
  // Advance age
  const newResources = { ...player.resources };
  for (const [resource, amount] of Object.entries(requirements)) {
    newResources[resource as ResourceType] -= amount;
  }
  
  const newPlayers = state.players.map(p =>
    p.id === player.id ? { ...p, age: nextAge as Age, resources: newResources } : p
  );
  
  return { ...state, players: newPlayers };
}

function aiTryBuildEconomic(state: RoNGameState, player: RoNPlayer): RoNGameState {
  // Count existing economic buildings
  let farms = 0;
  let lumber = 0;
  let mines = 0;
  
  state.grid.forEach(row => {
    row.forEach(tile => {
      if (tile.ownerId !== player.id || !tile.building) return;
      switch (tile.building.type) {
        case 'farm': farms++; break;
        case 'woodcutters_camp':
        case 'lumber_mill': lumber++; break;
        case 'mine':
        case 'smelter': mines++; break;
      }
    });
  });
  
  // Determine what to build
  let buildingType: RoNBuildingType | null = null;
  if (farms < 2) buildingType = 'farm';
  else if (lumber < 2) buildingType = 'woodcutters_camp';
  else if (mines < 1 && AGE_ORDER.indexOf(player.age) >= 1) buildingType = 'mine';
  
  if (!buildingType) return state;
  
  return aiPlaceBuilding(state, player, buildingType);
}

function aiTryBuildMilitary(state: RoNGameState, player: RoNPlayer): RoNGameState {
  // Count barracks
  let barracks = 0;
  state.grid.forEach(row => {
    row.forEach(tile => {
      if (tile.ownerId === player.id && tile.building?.type === 'barracks') {
        barracks++;
      }
    });
  });
  
  if (barracks >= 2) return state;
  
  return aiPlaceBuilding(state, player, 'barracks');
}

function aiPlaceBuilding(state: RoNGameState, player: RoNPlayer, buildingType: RoNBuildingType): RoNGameState {
  const stats = BUILDING_STATS[buildingType];
  if (!stats) return state;
  
  // Check resources
  for (const [resource, amount] of Object.entries(stats.cost)) {
    if (amount && player.resources[resource as ResourceType] < amount) {
      return state;
    }
  }
  
  // Pre-compute city centers for territory checks
  const cityCenters = extractCityCenters(state.grid, state.gridSize);
  
  // Find a suitable location WITHIN player's territory
  let bestPos: { x: number; y: number } | null = null;
  
  for (let y = 0; y < state.gridSize; y++) {
    for (let x = 0; x < state.gridSize; x++) {
      const tile = state.grid[y][x];
      
      // Check if location is valid
      if (tile.building || tile.terrain === 'water') continue;
      
      // Check if tile is within player's territory (not just "near" owned tiles)
      const territoryOwner = getTerritoryOwner(state.grid, state.gridSize, x, y, cityCenters);
      if (territoryOwner !== player.id) continue;
      
      // Check building size fits and all tiles are in territory
      let fits = true;
      for (let dy = 0; dy < stats.size.height; dy++) {
        for (let dx = 0; dx < stats.size.width; dx++) {
          const checkTile = state.grid[y + dy]?.[x + dx];
          if (!checkTile || checkTile.building || checkTile.terrain === 'water') {
            fits = false;
            break;
          }
          // Also check that all tiles of multi-tile buildings are in territory
          const tileOwner = getTerritoryOwner(state.grid, state.gridSize, x + dx, y + dy, cityCenters);
          if (tileOwner !== player.id) {
            fits = false;
            break;
          }
        }
        if (!fits) break;
      }
      
      if (fits) {
        bestPos = { x, y };
        break;
      }
    }
    if (bestPos) break;
  }
  
  if (!bestPos) return state;
  
  // Deduct resources
  const newResources = { ...player.resources };
  for (const [resource, amount] of Object.entries(stats.cost)) {
    if (amount) {
      newResources[resource as ResourceType] -= amount;
    }
  }
  
  // Create building
  const newBuilding: RoNBuilding = {
    type: buildingType,
    level: 1,
    ownerId: player.id,
    health: stats.maxHealth,
    maxHealth: stats.maxHealth,
    constructionProgress: 100, // AI buildings are instant for simplicity
    queuedUnits: [],
    productionProgress: 0,
    garrisonedUnits: [],
  };
  
  // Update grid
  const newGrid = state.grid.map((row, gy) =>
    row.map((tile, gx) => {
      if (gx >= bestPos!.x && gx < bestPos!.x + stats.size.width &&
          gy >= bestPos!.y && gy < bestPos!.y + stats.size.height) {
        return {
          ...tile,
          building: gx === bestPos!.x && gy === bestPos!.y ? newBuilding : null,
          ownerId: player.id,
        };
      }
      return tile;
    })
  );
  
  const newPlayers = state.players.map(p =>
    p.id === player.id ? { ...p, resources: newResources } : p
  );
  
  return { ...state, grid: newGrid, players: newPlayers };
}

function aiTryTrainUnits(state: RoNGameState, player: RoNPlayer): RoNGameState {
  if (player.population >= player.populationCap - 2) return state;
  
  // Count units
  let citizens = 0;
  let military = 0;
  
  state.units.forEach(u => {
    if (u.ownerId !== player.id) return;
    if (u.type === 'citizen') citizens++;
    else military++;
  });
  
  // Determine what to train
  let unitType: UnitType | null = null;
  let buildingType: RoNBuildingType | null = null;
  
  if (citizens < 6) {
    unitType = 'citizen';
    buildingType = 'city_center';
  } else if (military < citizens) {
    unitType = 'militia';
    buildingType = 'barracks';
  }
  
  if (!unitType || !buildingType) return state;
  
  // Find building
  let buildingPos: { x: number; y: number } | null = null;
  
  state.grid.forEach((row, y) => {
    row.forEach((tile, x) => {
      if (tile.ownerId === player.id && 
          tile.building?.type === buildingType &&
          tile.building.constructionProgress >= 100 &&
          tile.building.queuedUnits.length < 3) {
        buildingPos = { x, y };
      }
    });
  });
  
  if (!buildingPos) return state;
  
  const unitStats = UNIT_STATS[unitType];
  if (!unitStats) return state;
  
  // Check resources
  for (const [resource, amount] of Object.entries(unitStats.cost)) {
    if (amount && player.resources[resource as ResourceType] < amount) {
      return state;
    }
  }
  
  // Deduct resources and queue
  const newResources = { ...player.resources };
  for (const [resource, amount] of Object.entries(unitStats.cost)) {
    if (amount) {
      newResources[resource as ResourceType] -= amount;
    }
  }
  
  const newGrid = state.grid.map((row, gy) =>
    row.map((tile, gx) => {
      if (gx === buildingPos!.x && gy === buildingPos!.y && tile.building) {
        return {
          ...tile,
          building: {
            ...tile.building,
            queuedUnits: [...tile.building.queuedUnits, unitType!],
          },
        };
      }
      return tile;
    })
  );
  
  const newPlayers = state.players.map(p =>
    p.id === player.id ? { ...p, resources: newResources } : p
  );
  
  return { ...state, grid: newGrid, players: newPlayers };
}

function aiAssignIdleWorkers(state: RoNGameState, player: RoNPlayer): RoNGameState {
  // Find idle citizens
  const idleCitizens = state.units.filter(
    u => u.ownerId === player.id && u.type === 'citizen' && u.task === 'idle'
  );
  
  if (idleCitizens.length === 0) return state;
  
  // Find economic buildings that need workers (with capacity available)
  const economicBuildings: Array<{ x: number; y: number; type: RoNBuildingType }> = [];
  
  state.grid.forEach((row, y) => {
    row.forEach((tile, x) => {
      if (tile.ownerId === player.id && 
          tile.building && 
          tile.building.constructionProgress >= 100 &&
          ECONOMIC_BUILDINGS.includes(tile.building.type)) {
        // Check worker capacity
        const buildingStats = BUILDING_STATS[tile.building.type as RoNBuildingType];
        const maxWorkers = buildingStats?.maxWorkers ?? 999;
        const currentWorkers = countWorkersAtBuilding(state.units, x, y, player.id);
        if (currentWorkers < maxWorkers) {
          economicBuildings.push({ x, y, type: tile.building.type });
        }
      }
    });
  });
  
  if (economicBuildings.length === 0) return state;
  
  // Assign first idle citizen to a random building with capacity
  const citizen = idleCitizens[0];
  const building = economicBuildings[Math.floor(Math.random() * economicBuildings.length)];
  
  let taskType: UnitTask = 'gather_food';
  switch (building.type) {
    case 'farm': taskType = 'gather_food'; break;
    case 'woodcutters_camp':
    case 'lumber_mill': taskType = 'gather_wood'; break;
    case 'mine':
    case 'smelter': taskType = 'gather_metal'; break;
    case 'market': taskType = 'gather_gold'; break;
    case 'oil_well':
    case 'refinery': taskType = 'gather_oil'; break;
    case 'library':
    case 'university': taskType = 'gather_knowledge'; break;
  }
  
  const newUnits = state.units.map(u => {
    if (u.id === citizen.id) {
      return {
        ...u,
        task: taskType,
        taskTarget: { x: building.x, y: building.y },
        targetX: building.x,
        targetY: building.y,
        isMoving: true,
      };
    }
    return u;
  });
  
  return { ...state, units: newUnits };
}

function aiAttackIfStrong(state: RoNGameState, player: RoNPlayer, difficulty: string): RoNGameState {
  // Count military units
  const militaryUnits = state.units.filter(
    u => u.ownerId === player.id && u.type !== 'citizen' && u.task === 'idle'
  );
  
  const threshold = difficulty === 'easy' ? 10 : difficulty === 'medium' ? 6 : 3;
  if (militaryUnits.length < threshold) return state;
  
  // Find enemy buildings - use nested loop for proper type narrowing
  let attackTarget: { x: number; y: number } | undefined = undefined;
  
  outer: for (let y = 0; y < state.grid.length; y++) {
    const row = state.grid[y];
    for (let x = 0; x < row.length; x++) {
      const tile = row[x];
      if (tile.ownerId && tile.ownerId !== player.id && tile.building) {
        attackTarget = { x, y };
        break outer;
      }
    }
  }
  
  if (!attackTarget) return state;
  
  // Capture the value for use in callback
  const target = attackTarget;
  
  // Count military units that will attack for formation spreading
  const attackingUnits = state.units.filter(u => 
    u.ownerId === player.id && 
    u.type !== 'citizen' && 
    u.task === 'idle'
  );
  const numAttacking = attackingUnits.length;
  
  // Send military units to attack with formation spreading
  let unitIndex = 0;
  const newUnits = state.units.map(u => {
    if (u.ownerId === player.id && 
        u.type !== 'citizen' && 
        u.task === 'idle') {
      
      // Calculate offset for attack formation
      let offsetX = 0;
      let offsetY = 0;
      
      if (numAttacking > 1) {
        const spreadRadius = 0.8;
        if (unitIndex === 0) {
          offsetX = 0;
          offsetY = 0;
        } else {
          const angle = (unitIndex - 1) * (Math.PI * 2 / Math.max(1, numAttacking - 1));
          const ring = Math.floor((unitIndex - 1) / 6) + 1;
          offsetX = Math.cos(angle) * spreadRadius * ring;
          offsetY = Math.sin(angle) * spreadRadius * ring;
        }
      }
      
      unitIndex++;
      
      return {
        ...u,
        task: 'attack' as UnitTask,
        taskTarget: target,
        targetX: target.x + offsetX,
        targetY: target.y + offsetY,
        isMoving: true,
      };
    }
    return u;
  });
  
  return { ...state, units: newUnits };
}

/**
 * Check victory conditions
 */
function checkVictoryConditions(state: RoNGameState): RoNGameState {
  // Check if any player has no buildings (defeated)
  const newPlayers = state.players.map(player => {
    if (player.isDefeated) return player;
    
    let hasBuildings = false;
    state.grid.forEach(row => {
      row.forEach(tile => {
        if (tile.ownerId === player.id && tile.building) {
          hasBuildings = true;
        }
      });
    });
    
    if (!hasBuildings) {
      return { ...player, isDefeated: true };
    }
    return player;
  });
  
  // Check for winner
  const activePlayers = newPlayers.filter(p => !p.isDefeated);
  let winnerId: string | null = null;
  let gameOver = false;
  
  if (activePlayers.length === 1) {
    winnerId = activePlayers[0].id;
    gameOver = true;
  } else if (activePlayers.length === 0) {
    gameOver = true; // Draw
  }
  
  return { ...state, players: newPlayers, gameOver, winnerId };
}
