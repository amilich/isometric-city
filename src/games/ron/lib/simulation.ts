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

// Simulation constants
const CONSTRUCTION_SPEED = 1; // Progress per tick (slower construction)
const PRODUCTION_SPEED = 0.5; // Unit production progress per tick (3x slower)
const UNIT_MOVE_SPEED = 0.1; // Movement per tick (in tiles)
const ATTACK_COOLDOWN = 10; // Ticks between attacks
const RESOURCE_GATHER_RATE = 0.15; // Base gathering per tick per worker (3x slower)

// Border/Territory constants
const CITY_CENTER_RADIUS = 24; // Base territory radius from city centers (3x larger for warring states style)
const FORT_RADIUS = 10; // Smaller territory radius for forts/defensive buildings
const ATTRITION_DAMAGE = 0.02; // Damage per tick when in enemy territory (reduced for slower attrition)
const ATTRITION_TICK_INTERVAL = 30; // Apply attrition every N ticks (less frequent)

// Auto-work constants for idle villagers
const IDLE_AUTO_WORK_THRESHOLD = 15; // Ticks of idle before auto-assigning work
const AUTO_WORK_SEARCH_RADIUS = 20; // Tiles radius to search for nearby work (broad search)

// City center building types that create territory
const CITY_CENTER_TYPES: RoNBuildingType[] = ['city_center', 'small_city', 'large_city', 'major_city'];

// Fort/defensive building types that extend territory (smaller radius)
const FORT_TYPES: RoNBuildingType[] = ['tower', 'stockade', 'fort', 'fortress', 'bunker', 'castle'];

/**
 * Territory source - either a city center or a fort
 */
type TerritorySource = { x: number; y: number; ownerId: string; radius: number };
let cachedTerritorySources: TerritorySource[] = [];
let territoryCacheVersion = -1;

// Short unit ID counter - produces IDs like "u1", "u2", etc.
let unitIdCounter = 0;
function generateUnitId(): string {
  return `u${++unitIdCounter}`;
}

/**
 * Extract all territory sources from the grid (city centers and forts)
 * Call once per frame/tick, not per tile for performance.
 */
export function extractCityCenters(grid: RoNTile[][], gridSize: number): TerritorySource[] {
  const sources: TerritorySource[] = [];
  for (let cy = 0; cy < gridSize; cy++) {
    for (let cx = 0; cx < gridSize; cx++) {
      const tile = grid[cy]?.[cx];
      if (!tile?.building || !tile.building.ownerId) continue;
      
      const buildingType = tile.building.type as RoNBuildingType;
      
      if (CITY_CENTER_TYPES.includes(buildingType)) {
        sources.push({ x: cx, y: cy, ownerId: tile.building.ownerId, radius: CITY_CENTER_RADIUS });
      } else if (FORT_TYPES.includes(buildingType)) {
        sources.push({ x: cx, y: cy, ownerId: tile.building.ownerId, radius: FORT_RADIUS });
      }
    }
  }
  return sources;
}

/**
 * Get the territory owner for a specific tile position.
 * Territory is determined by proximity to city centers and forts.
 * Returns the player ID who owns the territory, or null if unclaimed.
 * 
 * PERFORMANCE: Pass pre-computed territorySources array to avoid O(n²) grid scan per call.
 */
export function getTerritoryOwner(
  grid: RoNTile[][],
  gridSize: number,
  x: number,
  y: number,
  territorySources?: TerritorySource[]
): string | null {
  // Use provided sources or extract them (fallback for backwards compatibility)
  const sources = territorySources ?? extractCityCenters(grid, gridSize);
  
  let closestOwner: string | null = null;
  let closestDistance = Infinity;
  
  // Find closest territory source (city center or fort)
  for (const source of sources) {
    const dist = Math.sqrt((x - source.x) ** 2 + (y - source.y) ** 2);
    
    // Only count if within this source's radius
    if (dist <= source.radius && dist < closestDistance) {
      closestDistance = dist;
      closestOwner = source.ownerId;
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

  // Defensive buildings attack nearby enemies
  newState = updateDefensiveBuildings(newState);

  // Update units (movement, gathering, combat)
  newState = updateUnits(newState);

  // Note: AI is now handled by the Agentic AI system via API calls
  // The old utility-based AI has been removed

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
 * Find an adjacent water tile for naval unit spawning
 * Searches around the building footprint for water tiles
 */
function findAdjacentWaterTile(
  grid: RoNTile[][],
  buildingX: number,
  buildingY: number,
  buildingWidth: number,
  buildingHeight: number,
  gridSize: number
): { x: number; y: number } | null {
  // Check all tiles around the building perimeter
  const candidates: { x: number; y: number }[] = [];
  
  // Check tiles around the building perimeter (prioritize bottom/right for docks facing water)
  for (let dx = -1; dx <= buildingWidth; dx++) {
    for (let dy = -1; dy <= buildingHeight; dy++) {
      // Skip interior tiles
      if (dx >= 0 && dx < buildingWidth && dy >= 0 && dy < buildingHeight) continue;
      
      const checkX = buildingX + dx;
      const checkY = buildingY + dy;
      
      if (checkX < 0 || checkX >= gridSize || checkY < 0 || checkY >= gridSize) continue;
      
      const tile = grid[checkY]?.[checkX];
      if (tile?.terrain === 'water') {
        candidates.push({ x: checkX, y: checkY });
      }
    }
  }
  
  // Return a random water tile from candidates (to spread spawns)
  if (candidates.length > 0) {
    return candidates[Math.floor(Math.random() * candidates.length)];
  }
  
  return null;
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
            
            // Determine spawn position based on unit type
            let spawnX: number;
            let spawnY: number;
            
            if (unitStats.isNaval) {
              // Naval units need to spawn on water - find adjacent water tile
              const waterSpawn = findAdjacentWaterTile(state.grid, x, y, buildingWidth, buildingHeight, state.gridSize);
              if (waterSpawn) {
                spawnX = waterSpawn.x + 0.5 + (Math.random() - 0.5) * 0.5;
                spawnY = waterSpawn.y + 0.5 + (Math.random() - 0.5) * 0.5;
              } else {
                // Fallback - spawn at dock position (might get stuck, but better than nothing)
                spawnX = x + buildingWidth / 2;
                spawnY = y + buildingHeight / 2;
              }
            } else {
              // Land units - spawn at random position around the bottom/front of the building
              const spawnOffsetX = (Math.random() - 0.5) * (buildingWidth + 1);
              const spawnOffsetY = buildingHeight + 0.3 + Math.random() * 0.6;
              spawnX = x + buildingWidth / 2 + spawnOffsetX;
              spawnY = y + spawnOffsetY;
            }
            
            const newUnit: Unit = {
              id: generateUnitId(),
              type: unitType,
              ownerId: building.ownerId,
              x: spawnX,
              y: spawnY,
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

/**
 * Defensive buildings (towers, forts) automatically attack nearby enemy military units
 */
function updateDefensiveBuildings(state: RoNGameState): RoNGameState {
  // Only process every few ticks for performance
  if (state.tick % 3 !== 0) return state;
  
  let newUnits = [...state.units];
  const defensiveBuildingTypes = ['tower', 'stockade', 'fort', 'fortress', 'bunker', 'castle', 'redoubt'];
  
  // Find all defensive buildings
  for (let y = 0; y < state.gridSize; y++) {
    for (let x = 0; x < state.gridSize; x++) {
      const tile = state.grid[y]?.[x];
      if (!tile?.building) continue;
      if (!tile.building.ownerId) continue;
      if (tile.building.constructionProgress < 100) continue;
      
      const buildingType = tile.building.type as RoNBuildingType;
      if (!defensiveBuildingTypes.includes(buildingType)) continue;
      
      const stats = BUILDING_STATS[buildingType];
      const attackDamage = stats.attackDamage || 0;
      const attackRange = stats.attackRange || 0;
      
      if (attackDamage <= 0 || attackRange <= 0) continue;
      
      // Find enemy military units within range
      const buildingCenterX = x + ((stats.size?.width || 1) / 2);
      const buildingCenterY = y + ((stats.size?.height || 1) / 2);
      
      let closestEnemy: { unit: Unit; dist: number; index: number } | null = null;
      
      for (let i = 0; i < newUnits.length; i++) {
        const unit = newUnits[i];
        if (unit.ownerId === tile.building.ownerId) continue; // Skip friendly units
        if (unit.health <= 0) continue; // Skip dead units
        
        // Only attack military units
        const unitStats = UNIT_STATS[unit.type];
        if (unitStats?.category === 'civilian') continue;
        
        const dist = Math.sqrt(
          (unit.x - buildingCenterX) ** 2 + (unit.y - buildingCenterY) ** 2
        );
        
        if (dist <= attackRange) {
          if (!closestEnemy || dist < closestEnemy.dist) {
            closestEnemy = { unit, dist, index: i };
          }
        }
      }
      
      // Attack the closest enemy
      if (closestEnemy) {
        const newHealth = closestEnemy.unit.health - attackDamage;
        newUnits[closestEnemy.index] = {
          ...closestEnemy.unit,
          health: newHealth,
        };
        
        // Debug log defensive building attack
        console.log(`[DEFENSE] ${buildingType} at (${x},${y}) attacks ${closestEnemy.unit.type}, dmg=${attackDamage}, hp=${newHealth}/${closestEnemy.unit.maxHealth}`);
      }
    }
  }
  
  // Remove dead units and log deaths
  const deadUnits = newUnits.filter(u => u.health <= 0);
  for (const dead of deadUnits) {
    console.log(`[DEFENSE KILL] ${dead.type} (${dead.id}) killed by defensive building`);
  }
  newUnits = newUnits.filter(u => u.health > 0);
  
  return { ...state, units: newUnits };
}

// Detection range for auto-attack (in tiles) - large range so units respond to threats
const AUTO_ATTACK_RANGE = 8;
// Detection range for civilian flee behavior (in tiles)
const CIVILIAN_FLEE_RANGE = 4;
// Reaction delay before civilians start fleeing (in ticks) - takes time to notice danger
const FLEE_REACTION_DELAY = 40;

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
 * Find nearby enemy military units (for civilian fleeing)
 */
function findNearbyEnemyMilitary(
  unit: Unit,
  allUnits: Unit[],
  range: number
): Unit[] {
  const enemies: Unit[] = [];
  
  for (const other of allUnits) {
    // Skip same owner, dead units, self, and non-military
    if (other.ownerId === unit.ownerId || other.health <= 0 || other.id === unit.id) continue;
    if (!isMilitaryUnit(other)) continue;
    
    const dist = Math.sqrt((other.x - unit.x) ** 2 + (other.y - unit.y) ** 2);
    if (dist <= range) {
      enemies.push(other);
    }
  }
  
  // Sort by distance (closest first)
  return enemies.sort((a, b) => {
    const distA = Math.sqrt((a.x - unit.x) ** 2 + (a.y - unit.y) ** 2);
    const distB = Math.sqrt((b.x - unit.x) ** 2 + (b.y - unit.y) ** 2);
    return distA - distB;
  });
}

/**
 * Find nearby enemy buildings within range
 */
function findNearbyEnemyBuilding(
  unit: Unit,
  grid: RoNTile[][],
  gridSize: number,
  range: number
): { x: number; y: number; type: string } | null {
  const unitX = Math.floor(unit.x);
  const unitY = Math.floor(unit.y);
  
  let closestBuilding: { x: number; y: number; type: string; dist: number } | null = null;
  
  // Search in a square around the unit
  const searchRadius = Math.ceil(range);
  for (let dy = -searchRadius; dy <= searchRadius; dy++) {
    for (let dx = -searchRadius; dx <= searchRadius; dx++) {
      const tx = unitX + dx;
      const ty = unitY + dy;
      
      if (tx < 0 || tx >= gridSize || ty < 0 || ty >= gridSize) continue;
      
      const tile = grid[ty]?.[tx];
      if (!tile?.building) continue;
      if (!tile.building.ownerId) continue;
      if (tile.building.ownerId === unit.ownerId) continue; // Skip own buildings
      if (tile.building.health <= 0) continue;
      
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > range) continue;
      
      if (!closestBuilding || dist < closestBuilding.dist) {
        closestBuilding = { x: tx, y: ty, type: tile.building.type, dist };
      }
    }
  }
  
  return closestBuilding ? { x: closestBuilding.x, y: closestBuilding.y, type: closestBuilding.type } : null;
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
  
  // Track damage to apply to units - key is unit ID, value is total damage
  // This is needed because when unit A attacks unit B, B might not be in newUnits yet
  // (if A is processed before B in the loop)
  const damageToApply: Map<string, number> = new Map();
  
  // Track damage to apply to buildings - key is "x,y" of building origin, value is total damage
  // This is needed because multiple units might attack the same building in one tick
  const buildingDamageToApply: Map<string, number> = new Map();
  
  // Track units that died this tick (for population decrease)
  const deadUnitOwners: string[] = [];

  for (let unitIndex = 0; unitIndex < originalUnits.length; unitIndex++) {
    const unit = originalUnits[unitIndex];
    let updatedUnit = { ...unit };
    
    // Debug: log air unit state at start of tick (every 60 ticks)
    const unitStats = UNIT_STATS[unit.type];
    if (unitStats?.category === 'air' && state.tick % 60 === 0) {
      console.log(`[AIR STATE] ${unit.type}(${unit.id}) task=${unit.task} taskTarget=${JSON.stringify(unit.taskTarget)} isMoving=${unit.isMoving} targetX=${unit.targetX} targetY=${unit.targetY} cooldown=${unit.attackCooldown}`);
    }
    
    // Reset isAttacking flag each tick - will be set true if attack occurs
    updatedUnit.isAttacking = false;
    
    // Track idle time for citizens - auto-assign work if idle too long
    if (updatedUnit.type === 'citizen') {
      // Check if worker is stuck: has gather task but no valid target
      const hasGatherTask = updatedUnit.task?.startsWith('gather_');
      const hasValidTarget = updatedUnit.taskTarget && 
        typeof updatedUnit.taskTarget === 'object' && 
        'x' in updatedUnit.taskTarget;
      
      // Reset stuck workers to idle so they can be re-assigned
      if (hasGatherTask && !hasValidTarget && !updatedUnit.isMoving) {
        updatedUnit.task = 'idle';
        updatedUnit.taskTarget = undefined;
      }
      
      const isIdle = updatedUnit.task === 'idle' || updatedUnit.task === undefined;
      
      if (isIdle && !updatedUnit.isMoving) {
        // Set or update idleSince
        if (updatedUnit.idleSince === undefined) {
          updatedUnit.idleSince = state.tick;
        }
        
        // Check if idle long enough to auto-assign work
        // Add per-unit randomization to prevent all citizens triggering at once
        // Use character code sum for hash since unit IDs may not be hex
        const idHash = updatedUnit.id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
        const unitIdHash = idHash % 10;
        const idleThreshold = IDLE_AUTO_WORK_THRESHOLD + unitIdHash;
        const idleDuration = state.tick - updatedUnit.idleSince;
        if (idleDuration >= idleThreshold) {
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
    
    // Auto-attack for military units: check for nearby enemies and engage them
    // BUT respect player commands - don't override move commands or attack commands
    if (isMilitaryUnit(updatedUnit)) {
      const nearbyEnemies = findNearbyEnemies(updatedUnit, state.units, AUTO_ATTACK_RANGE);
      
      if (nearbyEnemies.length > 0) {
        const currentTarget = updatedUnit.taskTarget;
        const closestEnemy = nearbyEnemies[0];
        
        // Don't auto-attack if:
        // 1. Already attacking a valid unit target (don't switch targets constantly)
        // 2. Already attacking a position (building) - don't interrupt player commands!
        // 3. Player has given a move command - respect their movement order!
        const isAlreadyAttackingUnit = 
          updatedUnit.task === 'attack' && 
          typeof currentTarget === 'string' && 
          state.units.find(u => u.id === currentTarget && u.health > 0);
        
        const isAlreadyAttackingBuilding = 
          updatedUnit.task === 'attack' && 
          typeof currentTarget === 'object' && 
          currentTarget !== null &&
          'x' in currentTarget;
        
        // Check if player gave a move command - respect it!
        const isMovingByPlayerCommand = 
          updatedUnit.task === 'move' && 
          updatedUnit.isMoving;
        
        // Only auto-engage if idle or just standing around (no active player command)
        const shouldAutoEngage = 
          !isAlreadyAttackingUnit && 
          !isAlreadyAttackingBuilding && 
          !isMovingByPlayerCommand;
        
        if (shouldAutoEngage) {
          // No current command - engage nearby enemy!
          updatedUnit.task = 'attack';
          updatedUnit.taskTarget = closestEnemy.id;
          updatedUnit.targetX = closestEnemy.x;
          updatedUnit.targetY = closestEnemy.y;
          updatedUnit.isMoving = true;
          // Reset cooldown so unit can attack immediately when in range
          updatedUnit.attackCooldown = 0;
          
          console.log(`[AUTO-ENGAGE] ${updatedUnit.type}(${updatedUnit.id}) engaging ${closestEnemy.type}(${closestEnemy.id})`);
        }
      }
    }
    
    // Civilian fleeing: if a civilian sees nearby enemy military units, flee!
    // But with a reaction delay - civilians don't instantly notice danger
    if (!isMilitaryUnit(updatedUnit)) {
      const nearbyEnemyMilitary = findNearbyEnemyMilitary(updatedUnit, state.units, CIVILIAN_FLEE_RANGE);
      
      if (nearbyEnemyMilitary.length > 0) {
        // Track when enemy was first spotted
        if (updatedUnit.enemySpottedAt === undefined) {
          updatedUnit.enemySpottedAt = state.tick;
        }
        
        // Only flee after reaction delay has passed
        const timeSinceSpotted = state.tick - updatedUnit.enemySpottedAt;
        if (timeSinceSpotted >= FLEE_REACTION_DELAY) {
          // Calculate flee direction (away from the average position of enemies)
          let avgEnemyX = 0;
          let avgEnemyY = 0;
          for (const enemy of nearbyEnemyMilitary) {
            avgEnemyX += enemy.x;
            avgEnemyY += enemy.y;
          }
          avgEnemyX /= nearbyEnemyMilitary.length;
          avgEnemyY /= nearbyEnemyMilitary.length;
          
          // Flee in the opposite direction
          const fleeDistance = 8; // Flee 8 tiles away
          const dx = updatedUnit.x - avgEnemyX;
          const dy = updatedUnit.y - avgEnemyY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist > 0.1) {
            // Normalize and scale
            const fleeX = updatedUnit.x + (dx / dist) * fleeDistance;
            const fleeY = updatedUnit.y + (dy / dist) * fleeDistance;
            
            // Clamp to grid bounds
            const gridSize = state.grid.length;
            updatedUnit.targetX = Math.max(1, Math.min(gridSize - 2, fleeX));
            updatedUnit.targetY = Math.max(1, Math.min(gridSize - 2, fleeY));
            updatedUnit.task = 'flee';
            updatedUnit.taskTarget = undefined;
            updatedUnit.isMoving = true;
            updatedUnit.idleSince = undefined; // Reset idle timer while fleeing
          }
        }
      } else {
        // No enemies nearby - reset the spotted timer
        updatedUnit.enemySpottedAt = undefined;
        
        if (updatedUnit.task === 'flee' && !updatedUnit.isMoving) {
          // Stopped fleeing - go back to idle so auto-work can kick in
          updatedUnit.task = 'idle';
          updatedUnit.idleSince = state.tick;
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
      
      // Debug: log air unit movement every 30 ticks
      if (unitStats?.category === 'air' && state.tick % 30 === 0) {
        console.log(`[AIR MOVE] ${updatedUnit.type}(${updatedUnit.id}) pos=(${updatedUnit.x.toFixed(1)},${updatedUnit.y.toFixed(1)}) -> target=(${updatedUnit.targetX.toFixed(1)},${updatedUnit.targetY.toFixed(1)}) dist=${dist.toFixed(1)} speed=${speed.toFixed(2)} task=${updatedUnit.task}`);
      }

      // For gathering tasks, stop when close to the building (not exactly on it)
      const arrivalDist = updatedUnit.task?.startsWith('gather_') ? 1.5 : speed;

      if (dist < arrivalDist) {
        // Arrived - position depends on task type
        const targetPos = updatedUnit.taskTarget && typeof updatedUnit.taskTarget === 'object' && 'x' in updatedUnit.taskTarget
          ? updatedUnit.taskTarget as { x: number; y: number }
          : null;
        
        if (targetPos) {
          const unitIndex = state.units.findIndex(u => u.id === unit.id);
          
          // Check what building type is at the target location
          const targetTileX = Math.floor(targetPos.x);
          const targetTileY = Math.floor(targetPos.y);
          const targetTile = state.grid[targetTileY]?.[targetTileX];
          const targetBuildingType = targetTile?.building?.type;
          
          if (updatedUnit.task === 'gather_food') {
            // Farm workers should be ON the farm tile (within bounds)
            // Keep spread tight to stay within the 1x1 farm sprite
            const angle = Math.random() * Math.PI * 2;
            const spreadDist = 0.1 + Math.random() * 0.35; // 0.1 to 0.45 tiles from center (stays within farm)
            updatedUnit.x = targetPos.x + 0.5 + Math.cos(angle) * spreadDist;
            updatedUnit.y = targetPos.y + 0.5 + Math.sin(angle) * spreadDist;
          } else if (updatedUnit.task === 'gather_wood' || updatedUnit.task === 'gather_metal') {
            // Processing buildings (lumber_mill, smelter) - workers cluster close to building
            // Resource extraction (woodcutters_camp, mine) - workers can spread further to resources
            const isProcessingBuilding = targetBuildingType === 'lumber_mill' || targetBuildingType === 'smelter';
            
            if (isProcessingBuilding) {
              // Cluster close to processing buildings
              const angle = Math.random() * Math.PI * 2;
              const spreadDist = 0.3 + Math.random() * 0.5; // 0.3 to 0.8 tiles from center
              updatedUnit.x = targetPos.x + 0.5 + Math.cos(angle) * spreadDist;
              updatedUnit.y = targetPos.y + 0.5 + Math.sin(angle) * spreadDist;
            } else {
              // Extraction buildings (woodcutters_camp, mine) - spread to gather from resources
              const angle = (unitIndex * 1.2) + Math.random() * 1.5;
              const spreadDist = 1.0 + Math.random() * 1.5; // 1.0 to 2.5 tiles from center
              updatedUnit.x = targetPos.x + Math.cos(angle) * spreadDist;
              updatedUnit.y = targetPos.y + Math.sin(angle) * spreadDist;
            }
          } else if (updatedUnit.task === 'gather_oil') {
            // Refinery is a processing building - workers cluster close
            // Oil_well/oil_platform are extraction - workers can spread more
            const isRefinery = targetBuildingType === 'refinery';
            
            if (isRefinery) {
              // Cluster close to processing building
              const angle = Math.random() * Math.PI * 2;
              const spreadDist = 0.3 + Math.random() * 0.5; // 0.3 to 0.8 tiles from center
              updatedUnit.x = targetPos.x + 0.5 + Math.cos(angle) * spreadDist;
              updatedUnit.y = targetPos.y + 0.5 + Math.sin(angle) * spreadDist;
            } else {
              // Oil well/platform extraction - spread around
              const angle = Math.random() * Math.PI * 2;
              const spreadDist = 0.6 + Math.random() * 1.0; // 0.6 to 1.6 tiles from center
              updatedUnit.x = targetPos.x + 0.5 + Math.cos(angle) * spreadDist;
              updatedUnit.y = targetPos.y + 0.5 + Math.sin(angle) * spreadDist;
            }
          } else if (updatedUnit.task === 'gather_knowledge' || updatedUnit.task === 'gather_gold') {
            // Library/market workers cluster close to buildings
            const angle = Math.random() * Math.PI * 2;
            const spreadDist = 0.4 + Math.random() * 0.6; // 0.4 to 1.0 tiles from center
            updatedUnit.x = targetPos.x + 0.5 + Math.cos(angle) * spreadDist;
            updatedUnit.y = targetPos.y + 0.5 + Math.sin(angle) * spreadDist;
          } else if (updatedUnit.task === 'gather_fish') {
            // Fishing boats should stay ON the fishing spot (water tile)
            // Keep spread very tight to stay within water boundaries
            const angle = Math.random() * Math.PI * 2;
            const spreadDist = 0.1 + Math.random() * 0.25; // 0.1 to 0.35 tiles from center
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
        // Check if unit is naval (can only move on water) or air (can fly over anything)
        const unitStats = UNIT_STATS[updatedUnit.type];
        const isNavalUnit = unitStats?.isNaval === true;
        const isAirUnit = unitStats?.category === 'air';
        
        if (isAirUnit) {
          // Air units fly directly to target - no pathfinding needed!
          const airDx = updatedUnit.targetX - updatedUnit.x;
          const airDy = updatedUnit.targetY - updatedUnit.y;
          const airDist = Math.sqrt(airDx * airDx + airDy * airDy);
          
          if (airDist > 0.01) {
            updatedUnit.x += (airDx / airDist) * speed;
            updatedUnit.y += (airDy / airDist) * speed;
          }
        } else {
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
    }
    
    // Combat
    if (updatedUnit.task === 'attack' && updatedUnit.taskTarget) {
      updatedUnit.attackCooldown = Math.max(0, updatedUnit.attackCooldown - 1);
      
      // Log when on cooldown (every 50 ticks to reduce spam)
      if (updatedUnit.attackCooldown > 0 && state.tick % 50 === 0) {
        console.log(`[COOLDOWN] ${updatedUnit.type}(${updatedUnit.id}) cooldown=${updatedUnit.attackCooldown}`);
      }
      
      if (updatedUnit.attackCooldown === 0) {
        const unitStats = UNIT_STATS[unit.type];
        const attackRange = unitStats?.range || 1;
        const damage = unitStats?.attack || 1;
        
        // Find target
        if (typeof updatedUnit.taskTarget === 'string') {
          // Target is a unit ID
          const targetUnit = state.units.find(u => u.id === updatedUnit.taskTarget && u.health > 0);
          if (targetUnit) {
            const dist = Math.sqrt(
              (targetUnit.x - updatedUnit.x) ** 2 + 
              (targetUnit.y - updatedUnit.y) ** 2
            );
            
            if (dist <= attackRange) {
              // Attack! Track damage to apply later (target might not be in newUnits yet)
              const currentDamage = damageToApply.get(targetUnit.id) || 0;
              damageToApply.set(targetUnit.id, currentDamage + damage);
              
              // Log every attack
              console.log(`[UNIT ATTACK] ${updatedUnit.type}(${updatedUnit.id}) -> ${targetUnit.type}(${targetUnit.id}), dmg=${damage}, dist=${dist.toFixed(1)}, range=${attackRange}`);
              
              updatedUnit.attackCooldown = ATTACK_COOLDOWN;
              updatedUnit.lastAttackTime = state.tick;
              updatedUnit.isAttacking = true; // Show attack animation
              updatedUnit.isMoving = false; // Stop moving while attacking
            } else {
              // Move toward target - must get in range first
              if (state.tick % 100 === 0) {
                console.log(`[MOVING TO TARGET] ${updatedUnit.type}(${updatedUnit.id}) -> ${targetUnit.type}(${targetUnit.id}), dist=${dist.toFixed(1)}, range=${attackRange}`);
              }
              updatedUnit.targetX = targetUnit.x;
              updatedUnit.targetY = targetUnit.y;
              updatedUnit.isMoving = true;
            }
          } else {
            // Target is dead or doesn't exist - find new target or go idle
            const nearbyEnemies = findNearbyEnemies(updatedUnit, state.units, AUTO_ATTACK_RANGE);
            if (nearbyEnemies.length > 0) {
              // Switch to new target
              const newTarget = nearbyEnemies[0];
              updatedUnit.taskTarget = newTarget.id;
              updatedUnit.targetX = newTarget.x;
              updatedUnit.targetY = newTarget.y;
              updatedUnit.isMoving = true;
              updatedUnit.attackCooldown = 0; // Can attack immediately
              console.log(`[TARGET SWITCH] ${updatedUnit.type}(${updatedUnit.id}) switching to ${newTarget.type}(${newTarget.id})`);
            } else {
              // No more enemies nearby - go idle
              updatedUnit.task = 'idle';
              updatedUnit.taskTarget = undefined;
              updatedUnit.isMoving = false;
            }
          }
        } else if ('x' in updatedUnit.taskTarget) {
          // Target is a position (building) - PRIORITIZE the ordered target!
          // Only auto-attack enemies AFTER the building is destroyed
          const targetPos = updatedUnit.taskTarget as { x: number; y: number };
          const distToTarget = Math.sqrt(
            (targetPos.x - updatedUnit.x) ** 2 + 
            (targetPos.y - updatedUnit.y) ** 2
          );
          
          // Debug: Log attack status periodically
          if (state.tick % 500 === 0 && updatedUnit.task === 'attack') {
            console.log(`[ATTACK STATUS] ${updatedUnit.type} at (${updatedUnit.x.toFixed(1)},${updatedUnit.y.toFixed(1)}) -> target (${targetPos.x},${targetPos.y}), dist=${distToTarget.toFixed(1)}`);
          }
          
          // FIRST check for building at target position - this is what the player ordered!
          // Only engage nearby enemies if there's NO building at the target
          // Use isTileOccupiedByBuilding to handle multi-tile buildings (e.g., 2x2 city_center)
          const targetTileX = Math.floor(targetPos.x);
          const targetTileY = Math.floor(targetPos.y);
          const buildingCheck = isTileOccupiedByBuilding(state.grid, targetTileX, targetTileY, state.gridSize);
          
          // Debug: log attack attempts for air units
          if (UNIT_STATS[updatedUnit.type]?.category === 'air' && state.tick % 30 === 0) {
            console.log(`[AIR ATTACK] ${updatedUnit.type}(${updatedUnit.id}) at (${updatedUnit.x.toFixed(1)},${updatedUnit.y.toFixed(1)}) -> target (${targetPos.x},${targetPos.y}), tileCheck=(${targetTileX},${targetTileY}), occupied=${buildingCheck.occupied}, buildingType=${buildingCheck.buildingType}, cooldown=${updatedUnit.attackCooldown}`);
          }
          
          // Find the actual building origin if this tile is part of a multi-tile building
          let buildingOrigin: { x: number; y: number; building: RoNBuilding } | null = null;
          if (buildingCheck.occupied) {
            // Search for the building origin
            const maxSize = 4;
            for (let dy = 0; dy < maxSize && !buildingOrigin; dy++) {
              for (let dx = 0; dx < maxSize && !buildingOrigin; dx++) {
                const originX = targetTileX - dx;
                const originY = targetTileY - dy;
                if (originX < 0 || originY < 0) continue;
                
                const originTile = state.grid[originY]?.[originX];
                if (originTile?.building) {
                  const bStats = BUILDING_STATS[originTile.building.type as RoNBuildingType];
                  if (bStats?.size) {
                    const { width, height } = bStats.size;
                    if (targetTileX >= originX && targetTileX < originX + width &&
                        targetTileY >= originY && targetTileY < originY + height) {
                      buildingOrigin = { x: originX, y: originY, building: originTile.building };
                    }
                  } else if (dx === 0 && dy === 0) {
                    // 1x1 building
                    buildingOrigin = { x: originX, y: originY, building: originTile.building };
                  }
                }
              }
            }
          }
          
          // Debug: log when building is found but might not be attacked
          if (buildingOrigin && state.tick % 200 === 0) {
            console.log(`[ATTACK DEBUG] Unit ${updatedUnit.id} at (${updatedUnit.x.toFixed(1)},${updatedUnit.y.toFixed(1)}) found building ${buildingOrigin.building.type} at (${buildingOrigin.x},${buildingOrigin.y}), buildingOwner=${buildingOrigin.building.ownerId}, unitOwner=${updatedUnit.ownerId}`);
          }
          
          if (buildingOrigin && buildingOrigin.building.ownerId !== updatedUnit.ownerId) {
            // VALID BUILDING TARGET - attack it! Don't get distracted by nearby enemies
            const bStats = BUILDING_STATS[buildingOrigin.building.type as RoNBuildingType];
            const buildingWidth = bStats?.size?.width || 1;
            const buildingHeight = bStats?.size?.height || 1;
            
            // Debug: log when unit is attacking a building
            if (state.tick % 20 === 0) {
              console.log(`[BUILDING TARGET] ${updatedUnit.type}(${updatedUnit.id}) targeting ${buildingOrigin.building.type} at (${buildingOrigin.x},${buildingOrigin.y}), size=${buildingWidth}x${buildingHeight}, unitPos=(${updatedUnit.x.toFixed(1)},${updatedUnit.y.toFixed(1)}), range=${attackRange}, cooldown=${updatedUnit.attackCooldown}`);
            }
            
            // Calculate distance to nearest edge of building
            let minDistToBuilding = Infinity;
            for (let by = 0; by < buildingHeight; by++) {
              for (let bx = 0; bx < buildingWidth; bx++) {
                const tileX = buildingOrigin.x + bx + 0.5; // Center of tile
                const tileY = buildingOrigin.y + by + 0.5;
                const dist = Math.sqrt(
                  (tileX - updatedUnit.x) ** 2 + (tileY - updatedUnit.y) ** 2
                );
                minDistToBuilding = Math.min(minDistToBuilding, dist);
              }
            }
            
            if (minDistToBuilding <= attackRange + 0.5) {
              // Attack building - track damage to apply later (multiple units may attack same building)
              const damage = unitStats?.attack || 1;
              const buildingKey = `${buildingOrigin.x},${buildingOrigin.y}`;
              const currentDamage = buildingDamageToApply.get(buildingKey) || 0;
              buildingDamageToApply.set(buildingKey, currentDamage + damage);
              
              // Debug log for building attacks (every tick for visibility)
              console.log(`[ATTACK] ${updatedUnit.type} attacking ${buildingOrigin.building.type} at (${buildingOrigin.x},${buildingOrigin.y}), dmg=${damage}, building hp=${buildingOrigin.building.health}`);
              
              updatedUnit.attackCooldown = ATTACK_COOLDOWN;
              updatedUnit.lastAttackTime = state.tick;
              updatedUnit.isAttacking = true;
              updatedUnit.isMoving = false;
            } else {
              // Move toward the nearest edge of the building
              // Find the closest tile of the building to move toward
              let closestTileX = buildingOrigin.x;
              let closestTileY = buildingOrigin.y;
              let closestDist = Infinity;
              for (let by = 0; by < buildingHeight; by++) {
                for (let bx = 0; bx < buildingWidth; bx++) {
                  const tileX = buildingOrigin.x + bx + 0.5;
                  const tileY = buildingOrigin.y + by + 0.5;
                  const dist = Math.sqrt(
                    (tileX - updatedUnit.x) ** 2 + (tileY - updatedUnit.y) ** 2
                  );
                  if (dist < closestDist) {
                    closestDist = dist;
                    closestTileX = tileX;
                    closestTileY = tileY;
                  }
                }
              }
              updatedUnit.targetX = closestTileX;
              updatedUnit.targetY = closestTileY;
              updatedUnit.isMoving = true;
            }
          } else if (distToTarget > 1) {
            // No building at target - keep moving toward target position
            updatedUnit.targetX = targetPos.x;
            updatedUnit.targetY = targetPos.y;
            updatedUnit.isMoving = true;
          } else {
            // Arrived at target position - building was destroyed or never existed
            // NOW we can look for new targets (auto-attack kicks in)
            
            // First, check for nearby enemy units
            const nearbyEnemies = findNearbyEnemies(updatedUnit, state.units, AUTO_ATTACK_RANGE);
            if (nearbyEnemies.length > 0) {
              // Found enemies - attack them!
              const closestEnemy = nearbyEnemies[0];
              updatedUnit.task = 'attack';
              updatedUnit.taskTarget = closestEnemy.id;
              updatedUnit.targetX = closestEnemy.x;
              updatedUnit.targetY = closestEnemy.y;
              updatedUnit.isMoving = true;
              updatedUnit.attackCooldown = 0;
            } else {
              // No enemies - look for nearby enemy buildings
              const nearbyEnemyBuilding = findNearbyEnemyBuilding(
                updatedUnit, 
                state.grid, 
                state.gridSize, 
                AUTO_ATTACK_RANGE * 2
              );
              
              if (nearbyEnemyBuilding) {
                // Found an enemy building - attack it!
                updatedUnit.task = 'attack';
                updatedUnit.taskTarget = { x: nearbyEnemyBuilding.x, y: nearbyEnemyBuilding.y };
                updatedUnit.targetX = nearbyEnemyBuilding.x + 0.5;
                updatedUnit.targetY = nearbyEnemyBuilding.y + 0.5;
                updatedUnit.isMoving = true;
              } else {
                // No enemies or buildings - go idle
                updatedUnit.task = 'idle';
                updatedUnit.taskTarget = undefined;
                updatedUnit.isMoving = false;
              }
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
    
    // Apply any accumulated damage to this unit from attacks this tick
    const damageTaken = damageToApply.get(updatedUnit.id) || 0;
    if (damageTaken > 0) {
      updatedUnit.health -= damageTaken;
      // Debug log combat damage
      console.log(`[COMBAT] ${updatedUnit.type} (${updatedUnit.id}) took ${damageTaken} damage, hp=${updatedUnit.health}/${updatedUnit.maxHealth}`);
    }
    
    // Only add if still alive
    if (updatedUnit.health > 0) {
      newUnits.push(updatedUnit);
    } else {
      // Unit died - log it and track for population decrease
      console.log(`[UNIT DIED] ${updatedUnit.type} (${updatedUnit.id}) at (${updatedUnit.x.toFixed(1)},${updatedUnit.y.toFixed(1)}), ownerId=${updatedUnit.ownerId}`);
      deadUnitOwners.push(updatedUnit.ownerId);
    }
  }
  
  // Decrease population for players who lost units
  let newPlayers = state.players;
  if (deadUnitOwners.length > 0) {
    // Count deaths per player
    const deathCounts: Map<string, number> = new Map();
    for (const ownerId of deadUnitOwners) {
      deathCounts.set(ownerId, (deathCounts.get(ownerId) || 0) + 1);
    }
    
    newPlayers = state.players.map(p => {
      const deaths = deathCounts.get(p.id) || 0;
      if (deaths > 0) {
        console.log(`[POPULATION] ${p.name} lost ${deaths} unit(s), population: ${p.population} -> ${p.population - deaths}`);
        return { ...p, population: Math.max(0, p.population - deaths) };
      }
      return p;
    });
  }
  
  // Apply all accumulated building damage
  if (buildingDamageToApply.size > 0) {
    console.log(`[BUILDING DAMAGE APPLY] Applying damage to ${buildingDamageToApply.size} buildings: ${Array.from(buildingDamageToApply.entries()).map(([k, v]) => `${k}:${v}`).join(', ')}`);
    newGrid = newGrid.map((row, gy) =>
      row.map((tile, gx) => {
        const key = `${gx},${gy}`;
        const damage = buildingDamageToApply.get(key);
        if (damage && tile.building) {
          const newHealth = tile.building.health - damage;
          console.log(`[BUILDING DAMAGE] ${tile.building.type} at (${gx},${gy}) took ${damage} damage, hp: ${tile.building.health} -> ${newHealth}`);
          
          if (newHealth <= 0) {
            // Building destroyed - clear the tile
            console.log(`[BUILDING DESTROYED] ${tile.building.type} at (${gx},${gy})`);
            return { ...tile, building: null, ownerId: null };
          }
          return { 
            ...tile, 
            building: { ...tile.building, health: newHealth }
          };
        }
        return tile;
      })
    );
  }
  
  return { ...state, units: newUnits, grid: newGrid, players: newPlayers };
}

/**
 * Check victory conditions
 * Players are eliminated if they have no cities for 2 minutes (~1200 ticks at speed 1)
 */
const ELIMINATION_TICKS = 1200; // ~2 minutes at normal speed (10 ticks/sec)

function checkVictoryConditions(state: RoNGameState): RoNGameState {
  const cityTypes = ['city_center', 'small_city', 'large_city', 'major_city'];
  
  const newPlayers = state.players.map(player => {
    if (player.isDefeated) return player;
    
    // Check if player has any cities
    let hasCities = false;
    state.grid.forEach(row => {
      row.forEach(tile => {
        if (tile.ownerId === player.id && tile.building && cityTypes.includes(tile.building.type)) {
          hasCities = true;
        }
      });
    });
    
    // Track when player lost their cities
    let noCitySinceTick = player.noCitySinceTick;
    
    if (hasCities) {
      // Player has cities - clear the timer
      noCitySinceTick = null;
    } else {
      // Player has no cities
      if (noCitySinceTick === null) {
        // Just lost cities - start the timer
        noCitySinceTick = state.tick;
        console.log(`[ELIMINATION] ${player.name} has no cities! Timer started at tick ${state.tick}`);
      } else {
        // Check if elimination timer expired
        const ticksWithoutCity = state.tick - noCitySinceTick;
        if (ticksWithoutCity >= ELIMINATION_TICKS) {
          console.log(`[ELIMINATION] ${player.name} eliminated! No cities for ${ticksWithoutCity} ticks`);
          return { ...player, isDefeated: true, noCitySinceTick };
        }
      }
    }
    
    return { ...player, noCitySinceTick };
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
