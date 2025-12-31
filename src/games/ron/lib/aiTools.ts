/**
 * Rise of Nations - Agentic AI Tools
 * 
 * Tool definitions for the OpenAI Responses SDK agentic AI.
 * These tools allow the AI to interact with the game state.
 */

import { RoNGameState, RoNPlayer, RoNTile } from '../types/game';
import { RoNBuildingType, BUILDING_STATS, UNIT_PRODUCTION_BUILDINGS, ECONOMIC_BUILDINGS } from '../types/buildings';
import { UnitType, UNIT_STATS, Unit, getUnitStatsForAge } from '../types/units';
import { AGE_ORDER, AGE_REQUIREMENTS } from '../types/ages';
import { ResourceType } from '../types/resources';
import { getTerritoryOwner, extractCityCenters } from './simulation';

/**
 * Check if a tile is occupied by a multi-tile building.
 * Buildings are stored on the origin tile, so we search backward to find footprints.
 */
function isTileOccupiedByBuilding(grid: RoNTile[][], gridX: number, gridY: number, gridSize: number): boolean {
  // Check if this tile itself has a building
  const tile = grid[gridY]?.[gridX];
  if (tile?.building) return true;
  
  // Check if this tile is part of a larger building's footprint
  // Search in a 4x4 area backward (to catch 3x3 and 4x4 buildings)
  for (let dy = 0; dy < 4; dy++) {
    for (let dx = 0; dx < 4; dx++) {
      const checkY = gridY - dy;
      const checkX = gridX - dx;
      if (checkX < 0 || checkY < 0 || checkX >= gridSize || checkY >= gridSize) continue;
      
      const checkTile = grid[checkY]?.[checkX];
      if (checkTile?.building) {
        const buildingType = checkTile.building.type as RoNBuildingType;
        const stats = BUILDING_STATS[buildingType];
        if (stats) {
          const width = stats.size?.width || 1;
          const height = stats.size?.height || 1;
          // Check if (gridX, gridY) falls within this building's footprint
          if (gridX >= checkX && gridX < checkX + width &&
              gridY >= checkY && gridY < checkY + height) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

/**
 * Result of a tool execution
 */
export interface ToolResult {
  success: boolean;
  message: string;
  data?: unknown;
}

/**
 * Condensed game state for AI consumption
 */
export interface CondensedGameState {
  tick: number;
  myPlayer: {
    id: string;
    name: string;
    age: string;
    resources: {
      food: number;
      wood: number;
      metal: number;
      gold: number;
      knowledge: number;
      oil: number;
    };
    resourceRates: {
      food: number;
      wood: number;
      metal: number;
      gold: number;
      knowledge: number;
      oil: number;
    };
    population: number;
    populationCap: number;
  };
  myUnits: Array<{
    id: string;
    type: string;
    x: number;
    y: number;
    health: number;
    maxHealth: number;
    task: string;
    isMoving: boolean;
  }>;
  myBuildings: Array<{
    type: string;
    x: number;
    y: number;
    health: number;
    maxHealth: number;
    constructionProgress: number;
    queuedUnits: string[];
  }>;
  enemyUnits: Array<{
    id: string;
    type: string;
    x: number;
    y: number;
    health: number;
    maxHealth: number;
  }>;
  enemyBuildings: Array<{
    type: string;
    x: number;
    y: number;
    health: number;
    maxHealth: number;
    ownerId: string;
  }>;
  mapSize: number;
  availableBuildingTypes: string[];
  availableUnitTypes: Array<{
    type: string;
    cost: Record<string, number>;
    producedAt: string[];
  }>;
  territoryTiles: Array<{ x: number; y: number }>;
  territoryBounds: { minX: number; maxX: number; minY: number; maxY: number }; // Your territory boundaries
  emptyTerritoryTiles: Array<{ x: number; y: number }>; // Empty tiles you can build on (closest to city first)
  tilesForCityExpansion: Array<{ x: number; y: number }>; // Tiles for new cities (FARTHEST from existing cities!)
  tilesNearForest: Array<{ x: number; y: number }>; // Good for woodcutters_camp
  tilesNearMetal: Array<{ x: number; y: number }>; // Good for mine
  tilesNearOil: Array<{ x: number; y: number }>; // Good for oil_well (industrial age+)
  resourceTiles: {
    forests: Array<{ x: number; y: number; density: number }>;
    metalDeposits: Array<{ x: number; y: number }>;
    oilDeposits: Array<{ x: number; y: number }>;
  };
  // Strategic assessment
  strategicAssessment: {
    myMilitaryStrength: number;  // Total military value
    enemyMilitaryStrength: number;
    strengthAdvantage: 'STRONGER' | 'EQUAL' | 'WEAKER';
    myWorkerCount: number;
    myMilitaryCount: number;
    enemyMilitaryCount: number;
    threatLevel: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    nearestEnemyDistance: number;
    isPopCapped: boolean;
    canAffordSmallCity: boolean;
    farmCount: number;
    woodcutterCount: number;
    mineCount: number;
    marketCount: number;
    libraryCount: number;
    stableCount: number;
    barracksCount: number;
  };
  // Age advancement info
  nextAgeRequirements: Record<string, number> | null; // null if at max age
  canAdvanceAge: boolean;
  // Enemy player info (for strategic assessment)
  enemyPlayers: Array<{
    id: string;
    name: string;
    age: string;
    population: number;
    isDefeated: boolean;
  }>;
}

/**
 * Generate a condensed game state for the AI
 */
export function generateCondensedGameState(
  state: RoNGameState,
  aiPlayerId: string
): CondensedGameState {
  const aiPlayer = state.players.find(p => p.id === aiPlayerId);
  if (!aiPlayer) {
    throw new Error(`AI player ${aiPlayerId} not found`);
  }

  const cityCenters = extractCityCenters(state.grid, state.gridSize);

  // Collect units
  const myUnits = state.units
    .filter(u => u.ownerId === aiPlayerId)
    .map(u => ({
      id: u.id,
      type: u.type,
      x: Math.round(u.x * 10) / 10,
      y: Math.round(u.y * 10) / 10,
      health: u.health,
      maxHealth: u.maxHealth,
      task: u.task || 'idle',
      isMoving: u.isMoving,
    }));

  const enemyUnits = state.units
    .filter(u => u.ownerId !== aiPlayerId)
    .map(u => ({
      id: u.id,
      type: u.type,
      x: Math.round(u.x * 10) / 10,
      y: Math.round(u.y * 10) / 10,
      health: u.health,
      maxHealth: u.maxHealth,
    }));

  // Collect buildings
  const myBuildings: CondensedGameState['myBuildings'] = [];
  const enemyBuildings: CondensedGameState['enemyBuildings'] = [];
  const territoryTiles: Array<{ x: number; y: number }> = [];
  const forests: Array<{ x: number; y: number; density: number }> = [];
  const metalDeposits: Array<{ x: number; y: number }> = [];
  const oilDeposits: Array<{ x: number; y: number }> = [];

  for (let y = 0; y < state.gridSize; y++) {
    for (let x = 0; x < state.gridSize; x++) {
      const tile = state.grid[y][x];

      // Check territory
      const owner = getTerritoryOwner(state.grid, state.gridSize, x, y, cityCenters);
      if (owner === aiPlayerId) {
        territoryTiles.push({ x, y });
      }

      // Collect buildings
      if (tile.building) {
        if (tile.building.ownerId === aiPlayerId) {
          myBuildings.push({
            type: tile.building.type,
            x,
            y,
            health: tile.building.health,
            maxHealth: tile.building.maxHealth,
            constructionProgress: tile.building.constructionProgress,
            queuedUnits: tile.building.queuedUnits,
          });
        } else if (tile.building.ownerId) {
          enemyBuildings.push({
            type: tile.building.type,
            x,
            y,
            health: tile.building.health,
            maxHealth: tile.building.maxHealth,
            ownerId: tile.building.ownerId,
          });
        }
      }

      // Collect resource tiles (only in or near our territory)
      if (owner === aiPlayerId || owner === null) {
        if (tile.forestDensity > 0) {
          forests.push({ x, y, density: tile.forestDensity });
        }
        if (tile.hasMetalDeposit) {
          metalDeposits.push({ x, y });
        }
        if (tile.hasOilDeposit) {
          oilDeposits.push({ x, y });
        }
      }
    }
  }

  // Determine available building types based on age
  const ageIndex = AGE_ORDER.indexOf(aiPlayer.age);
  const availableBuildingTypes = Object.entries(BUILDING_STATS)
    .filter(([type, stats]) => {
      if (['empty', 'grass', 'water'].includes(type)) return false;
      const reqAgeIndex = AGE_ORDER.indexOf(stats.minAge);
      return reqAgeIndex <= ageIndex;
    })
    .map(([type]) => type);

  // Determine available unit types
  const availableUnitTypes: CondensedGameState['availableUnitTypes'] = [];
  for (const [unitType, stats] of Object.entries(UNIT_STATS)) {
    const reqAgeIndex = AGE_ORDER.indexOf(stats.minAge);
    if (reqAgeIndex <= ageIndex) {
      const producedAt: string[] = [];
      for (const [buildingType, units] of Object.entries(UNIT_PRODUCTION_BUILDINGS)) {
        if (units?.includes(unitType)) {
          producedAt.push(buildingType);
        }
      }
      if (producedAt.length > 0) {
        availableUnitTypes.push({
          type: unitType,
          cost: stats.cost as Record<string, number>,
          producedAt,
        });
      }
    }
  }

  return {
    tick: state.tick,
    myPlayer: {
      id: aiPlayer.id,
      name: aiPlayer.name,
      age: aiPlayer.age,
      resources: { ...aiPlayer.resources },
      resourceRates: { ...aiPlayer.resourceRates },
      population: aiPlayer.population,
      populationCap: aiPlayer.populationCap,
    },
    // Prioritize military units over citizens for attack commands
    myUnits: (() => {
      const military = myUnits.filter(u => u.type !== 'citizen');
      const citizens = myUnits.filter(u => u.type === 'citizen');
      // Include all military (up to 50) plus some citizens
      return [...military.slice(0, 50), ...citizens.slice(0, 10)];
    })(),
    // Ensure important buildings are included first (cities, barracks)
    myBuildings: (() => {
      const importantTypes = ['city_center', 'small_city', 'large_city', 'major_city', 'barracks', 'stable', 'dock', 'library', 'market'];
      const important = myBuildings.filter(b => importantTypes.includes(b.type));
      const others = myBuildings.filter(b => !importantTypes.includes(b.type));
      return [...important, ...others].slice(0, 25);
    })(),
    enemyUnits: enemyUnits.slice(0, 15),
    enemyBuildings: enemyBuildings.slice(0, 15),
    mapSize: state.gridSize,
    availableBuildingTypes,
    availableUnitTypes,
    territoryTiles: territoryTiles.slice(0, 10), // Reduced to save tokens
    // Calculate territory bounds
    territoryBounds: (() => {
      if (territoryTiles.length === 0) {
        return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
      }
      const xs = territoryTiles.map(t => t.x);
      const ys = territoryTiles.map(t => t.y);
      return {
        minX: Math.min(...xs),
        maxX: Math.max(...xs),
        minY: Math.min(...ys),
        maxY: Math.max(...ys),
      };
    })(),
    // Filter empty tiles that can fit a 2x2 building (barracks, etc.)
    // Find buildable tiles spread throughout territory (with randomization)
    emptyTerritoryTiles: (() => {
      // Check if a tile can be built on - uses isTileOccupiedByBuilding for multi-tile buildings!
      const canBuildable = (x: number, y: number): boolean => {
        const tile = state.grid[y]?.[x];
        if (!tile) return false;
        // Use multi-tile aware check
        if (isTileOccupiedByBuilding(state.grid, x, y, state.gridSize)) return false;
        if (tile.terrain === 'water' || tile.terrain === 'forest' || tile.terrain === 'mountain') return false;
        if (tile.forestDensity > 0) return false; // Trees block building
        if (tile.hasMetalDeposit) return false; // Metal deposits block building
        if (tile.hasOilDeposit) return false; // Oil deposits block building
        return true;
      };
      
      // Find AI's city centers to calculate distance
      const myCityCenters = myBuildings.filter(b => 
        b.type === 'city_center' || b.type === 'small_city' || b.type === 'large_city' || b.type === 'major_city'
      );
      
      // Get distance to NEAREST city center (for multi-city support)
      const distToNearestCity = (x: number, y: number): number => {
        if (myCityCenters.length === 0) {
          return Math.sqrt((x - state.gridSize / 2) ** 2 + (y - state.gridSize / 2) ** 2);
        }
        return Math.min(...myCityCenters.map(c => 
          Math.sqrt((x - c.x) ** 2 + (y - c.y) ** 2)
        ));
      };
      
      const empty = territoryTiles.filter(t => {
        if (!canBuildable(t.x, t.y)) return false;
        
        // Check if a 2x2 building can fit here (most buildings are 2x2)
        for (let dy = 0; dy < 2; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            if (!canBuildable(t.x + dx, t.y + dy)) return false;
          }
        }
        return true;
      });
      
      // SORT BY DISTANCE TO NEAREST CITY CENTER - build compact cities!
      empty.sort((a, b) => distToNearestCity(a.x, a.y) - distToNearestCity(b.x, b.y));
      
      // Take tiles with minimal spacing (3 tiles) to allow dense city building
      const spaced: typeof empty = [];
      for (const t of empty) {
        // Only 3 tiles apart - allows denser city layouts
        const tooClose = spaced.some(s => Math.abs(s.x - t.x) < 3 && Math.abs(s.y - t.y) < 3);
        if (!tooClose) spaced.push(t);
        if (spaced.length >= 8) break;
      }
      
      // Return tiles sorted by distance to city - closest first for compact cities
      return spaced;
    })(),
    // Find tiles for NEW CITY expansion - sorted FARTHEST from existing cities!
    // Cities should be spread out across the map, not adjacent to each other
    tilesForCityExpansion: (() => {
      // Check if a tile can be built on - uses isTileOccupiedByBuilding for multi-tile buildings!
      const canBuildable = (x: number, y: number): boolean => {
        const tile = state.grid[y]?.[x];
        if (!tile) return false;
        if (isTileOccupiedByBuilding(state.grid, x, y, state.gridSize)) return false;
        if (tile.terrain === 'water' || tile.terrain === 'forest' || tile.terrain === 'mountain') return false;
        if (tile.forestDensity > 0) return false;
        if (tile.hasMetalDeposit) return false;
        if (tile.hasOilDeposit) return false;
        return true;
      };
      
      // Find existing city centers
      const myCityCenters = myBuildings.filter(b => 
        b.type === 'city_center' || b.type === 'small_city' || b.type === 'large_city' || b.type === 'major_city'
      );
      
      // Get distance to NEAREST city center
      const distToNearestCity = (x: number, y: number): number => {
        if (myCityCenters.length === 0) {
          return Math.sqrt((x - state.gridSize / 2) ** 2 + (y - state.gridSize / 2) ** 2);
        }
        return Math.min(...myCityCenters.map(c => 
          Math.sqrt((x - c.x) ** 2 + (y - c.y) ** 2)
        ));
      };
      
      // Filter tiles that can fit a 3x3 city
      const empty = territoryTiles.filter(t => {
        if (!canBuildable(t.x, t.y)) return false;
        // Check 3x3 footprint for small_city
        for (let dy = 0; dy < 3; dy++) {
          for (let dx = 0; dx < 3; dx++) {
            if (!canBuildable(t.x + dx, t.y + dy)) return false;
          }
        }
        return true;
      });
      
      // SORT BY DISTANCE - FARTHEST FIRST (opposite of emptyTerritoryTiles!)
      empty.sort((a, b) => distToNearestCity(b.x, b.y) - distToNearestCity(a.x, a.y));
      
      // Filter out tiles that are too close to existing cities (at least 15 tiles away)
      const MIN_CITY_DISTANCE = 15;
      const farEnough = empty.filter(t => distToNearestCity(t.x, t.y) >= MIN_CITY_DISTANCE);
      
      // If none are far enough, fall back to all tiles (sorted farthest first)
      const candidates = farEnough.length > 0 ? farEnough : empty;
      
      // Space out suggestions
      const spaced: typeof empty = [];
      for (const t of candidates) {
        const tooClose = spaced.some(s => Math.abs(s.x - t.x) < 5 && Math.abs(s.y - t.y) < 5);
        if (!tooClose) spaced.push(t);
        if (spaced.length >= 5) break;
      }
      
      return spaced;
    })(),
    // Find tiles ADJACENT to forests (good for woodcutters_camp)
    // SORTED by distance to city center - prefer forests near your base!
    tilesNearForest: (() => {
      const myCityCenters = myBuildings.filter(b => 
        b.type === 'city_center' || b.type === 'small_city' || b.type === 'large_city' || b.type === 'major_city'
      );
      const primaryCity = myCityCenters[0] || { x: state.gridSize / 2, y: state.gridSize / 2 };
      
      const filtered = territoryTiles.filter(t => {
        const tile = state.grid[t.y]?.[t.x];
        if (!tile) return false;
        // Use multi-tile aware building check
        if (isTileOccupiedByBuilding(state.grid, t.x, t.y, state.gridSize)) return false;
        if (tile.terrain === 'water' || tile.terrain === 'forest' || tile.terrain === 'mountain') return false;
        if (tile.forestDensity > 0) return false;
        if (tile.hasMetalDeposit || tile.hasOilDeposit) return false;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const adj = state.grid[t.y + dy]?.[t.x + dx];
            if (adj && (adj.forestDensity > 0 || adj.terrain === 'forest')) {
              return true;
            }
          }
        }
        return false;
      });
      // Sort by distance to city center
      filtered.sort((a, b) => {
        const distA = Math.sqrt((a.x - primaryCity.x) ** 2 + (a.y - primaryCity.y) ** 2);
        const distB = Math.sqrt((b.x - primaryCity.x) ** 2 + (b.y - primaryCity.y) ** 2);
        return distA - distB;
      });
      // Space out suggestions to avoid clustering
      const spaced: typeof filtered = [];
      for (const t of filtered) {
        const tooClose = spaced.some(s => Math.abs(s.x - t.x) < 2 && Math.abs(s.y - t.y) < 2);
        if (!tooClose) spaced.push(t);
        if (spaced.length >= 4) break;
      }
      return spaced;
    })(),
    // Find tiles ADJACENT to metal deposits (good for mine)
    // SORTED by distance to city center - prefer metal near your base!
    tilesNearMetal: (() => {
      const myCityCenters = myBuildings.filter(b => 
        b.type === 'city_center' || b.type === 'small_city' || b.type === 'large_city' || b.type === 'major_city'
      );
      const primaryCity = myCityCenters[0] || { x: state.gridSize / 2, y: state.gridSize / 2 };
      
      const filtered = territoryTiles.filter(t => {
        const tile = state.grid[t.y]?.[t.x];
        if (!tile) return false;
        // Use multi-tile aware building check
        if (isTileOccupiedByBuilding(state.grid, t.x, t.y, state.gridSize)) return false;
        if (tile.terrain === 'water' || tile.terrain === 'forest' || tile.terrain === 'mountain') return false;
        if (tile.forestDensity > 0 || tile.hasMetalDeposit || tile.hasOilDeposit) return false;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const adj = state.grid[t.y + dy]?.[t.x + dx];
            if (adj && adj.hasMetalDeposit) {
              return true;
            }
          }
        }
        return false;
      });
      // Sort by distance to city center
      filtered.sort((a, b) => {
        const distA = Math.sqrt((a.x - primaryCity.x) ** 2 + (a.y - primaryCity.y) ** 2);
        const distB = Math.sqrt((b.x - primaryCity.x) ** 2 + (b.y - primaryCity.y) ** 2);
        return distA - distB;
      });
      // Space out suggestions to avoid clustering
      const spaced: typeof filtered = [];
      for (const t of filtered) {
        const tooClose = spaced.some(s => Math.abs(s.x - t.x) < 2 && Math.abs(s.y - t.y) < 2);
        if (!tooClose) spaced.push(t);
        if (spaced.length >= 4) break;
      }
      return spaced;
    })(),
    // Find tiles ADJACENT to oil deposits (good for oil_well)
    // SORTED by distance to city center
    tilesNearOil: (() => {
      const myCityCenters = myBuildings.filter(b => 
        b.type === 'city_center' || b.type === 'small_city' || b.type === 'large_city' || b.type === 'major_city'
      );
      const primaryCity = myCityCenters[0] || { x: state.gridSize / 2, y: state.gridSize / 2 };
      
      const filtered = territoryTiles.filter(t => {
        const tile = state.grid[t.y]?.[t.x];
        if (!tile) return false;
        // Use multi-tile aware building check
        if (isTileOccupiedByBuilding(state.grid, t.x, t.y, state.gridSize)) return false;
        if (tile.terrain === 'water' || tile.terrain === 'forest' || tile.terrain === 'mountain') return false;
        if (tile.forestDensity > 0 || tile.hasMetalDeposit || tile.hasOilDeposit) return false;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const adj = state.grid[t.y + dy]?.[t.x + dx];
            if (adj && adj.hasOilDeposit) {
              return true;
            }
          }
        }
        return false;
      });
      // Sort by distance to city center
      filtered.sort((a, b) => {
        const distA = Math.sqrt((a.x - primaryCity.x) ** 2 + (a.y - primaryCity.y) ** 2);
        const distB = Math.sqrt((b.x - primaryCity.x) ** 2 + (b.y - primaryCity.y) ** 2);
        return distA - distB;
      });
      // Space out suggestions
      const spaced: typeof filtered = [];
      for (const t of filtered) {
        const tooClose = spaced.some(s => Math.abs(s.x - t.x) < 2 && Math.abs(s.y - t.y) < 2);
        if (!tooClose) spaced.push(t);
        if (spaced.length >= 4) break;
      }
      return spaced;
    })(),
    resourceTiles: {
      forests: forests.slice(0, 5),
      metalDeposits: metalDeposits.slice(0, 5),
      oilDeposits: oilDeposits.slice(0, 5),
    },
    // Calculate strategic assessment
    strategicAssessment: (() => {
      // Calculate military strength (unit value based on cost/stats)
      const unitValue = (type: string): number => {
        const stats = UNIT_STATS[type as UnitType];
        if (!stats) return 0;
        if (type === 'citizen') return 0; // Workers don't count as military
        // Value based on attack + health
        return (stats.attack || 0) * 2 + (stats.health || 0) / 10;
      };
      
      const myMilitary = myUnits.filter(u => u.type !== 'citizen');
      const enemyMilitary = enemyUnits.filter(u => u.type !== 'citizen');
      
      const myMilitaryStrength = myMilitary.reduce((sum, u) => sum + unitValue(u.type), 0);
      const enemyMilitaryStrength = enemyMilitary.reduce((sum, u) => sum + unitValue(u.type), 0);
      
      let strengthAdvantage: 'STRONGER' | 'EQUAL' | 'WEAKER' = 'EQUAL';
      if (myMilitaryStrength > enemyMilitaryStrength * 1.3) strengthAdvantage = 'STRONGER';
      else if (enemyMilitaryStrength > myMilitaryStrength * 1.3) strengthAdvantage = 'WEAKER';
      
      // Find nearest enemy
      const myCityCenter = myBuildings.find(b => b.type === 'city_center');
      let nearestEnemyDistance = 999;
      if (myCityCenter) {
        for (const enemy of [...enemyUnits, ...enemyBuildings]) {
          const dist = Math.sqrt(Math.pow(enemy.x - myCityCenter.x, 2) + Math.pow(enemy.y - myCityCenter.y, 2));
          if (dist < nearestEnemyDistance) nearestEnemyDistance = dist;
        }
      }
      
      // Determine threat level
      let threatLevel: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'NONE';
      if (nearestEnemyDistance < 10 && enemyMilitary.length > 0) threatLevel = 'CRITICAL';
      else if (nearestEnemyDistance < 20 && enemyMilitary.length >= 3) threatLevel = 'HIGH';
      else if (nearestEnemyDistance < 30 && enemyMilitary.length >= 2) threatLevel = 'MEDIUM';
      else if (enemyMilitary.length > 0) threatLevel = 'LOW';
      
      // Count buildings
      let farmCount = 0, woodcutterCount = 0, mineCount = 0, barracksCount = 0;
      let marketCount = 0, libraryCount = 0, stableCount = 0;
      for (const b of myBuildings) {
        if (b.type === 'farm' || b.type === 'granary') farmCount++;
        else if (b.type === 'woodcutters_camp' || b.type === 'lumber_mill') woodcutterCount++;
        else if (b.type === 'mine' || b.type === 'smelter') mineCount++;
        else if (b.type === 'barracks') barracksCount++;
        else if (b.type === 'market') marketCount++;
        else if (b.type === 'library' || b.type === 'university') libraryCount++;
        else if (b.type === 'stable') stableCount++;
      }
      
      const isPopCapped = aiPlayer.population >= aiPlayer.populationCap;
      const canAffordSmallCity = aiPlayer.resources.wood >= 400 && 
                                  aiPlayer.resources.gold >= 200 && 
                                  aiPlayer.resources.metal >= 100;
      
      return {
        myMilitaryStrength: Math.round(myMilitaryStrength),
        enemyMilitaryStrength: Math.round(enemyMilitaryStrength),
        strengthAdvantage,
        myWorkerCount: myUnits.filter(u => u.type === 'citizen').length,
        myMilitaryCount: myMilitary.length,
        enemyMilitaryCount: enemyMilitary.length,
        threatLevel,
        nearestEnemyDistance: Math.round(nearestEnemyDistance),
        isPopCapped,
        canAffordSmallCity,
        farmCount,
        woodcutterCount,
        mineCount,
        marketCount,
        libraryCount,
        stableCount,
        barracksCount,
      };
    })(),
    // Age advancement info
    nextAgeRequirements: (() => {
      const currentAgeIndex = AGE_ORDER.indexOf(aiPlayer.age);
      if (currentAgeIndex >= AGE_ORDER.length - 1) return null; // At max age
      const nextAge = AGE_ORDER[currentAgeIndex + 1];
      const req = AGE_REQUIREMENTS[nextAge];
      return req ? (req as unknown as Record<string, number>) : null;
    })(),
    canAdvanceAge: (() => {
      const currentAgeIndex = AGE_ORDER.indexOf(aiPlayer.age);
      if (currentAgeIndex >= AGE_ORDER.length - 1) return false;
      const nextAge = AGE_ORDER[currentAgeIndex + 1];
      const requirements = AGE_REQUIREMENTS[nextAge];
      if (!requirements) return false;
      for (const [resource, amount] of Object.entries(requirements)) {
        if (aiPlayer.resources[resource as ResourceType] < amount) return false;
      }
      return true;
    })(),
    // Enemy player info
    enemyPlayers: state.players
      .filter(p => p.id !== aiPlayerId)
      .map(p => ({
        id: p.id,
        name: p.name,
        age: p.age,
        population: p.population,
        isDefeated: p.isDefeated || false,
      })),
  };
}

/**
 * Validate and execute building placement
 */
export function executeBuildBuilding(
  state: RoNGameState,
  aiPlayerId: string,
  buildingType: string,
  x: number,
  y: number
): { newState: RoNGameState; result: ToolResult } {
  const player = state.players.find(p => p.id === aiPlayerId);
  if (!player) {
    return { newState: state, result: { success: false, message: 'AI player not found' } };
  }

  const bType = buildingType as RoNBuildingType;
  const stats = BUILDING_STATS[bType];
  if (!stats) {
    return { newState: state, result: { success: false, message: `Unknown building type: ${buildingType}` } };
  }

  // Check age requirement
  const ageIndex = AGE_ORDER.indexOf(player.age);
  const requiredAgeIndex = AGE_ORDER.indexOf(stats.minAge);
  if (ageIndex < requiredAgeIndex) {
    return { newState: state, result: { success: false, message: `Building requires ${stats.minAge} age, you are in ${player.age}` } };
  }

  // Check resources
  for (const [resource, amount] of Object.entries(stats.cost)) {
    if (amount && player.resources[resource as ResourceType] < amount) {
      return { newState: state, result: { success: false, message: `Not enough ${resource}. Need ${amount}, have ${player.resources[resource as ResourceType]}` } };
    }
  }

  // Check tile validity
  const tile = state.grid[y]?.[x];
  if (!tile) {
    return { newState: state, result: { success: false, message: `Invalid coordinates (${x}, ${y})` } };
  }
  if (tile.terrain === 'water') {
    return { newState: state, result: { success: false, message: 'Cannot build on water' } };
  }
  if (tile.forestDensity > 0) {
    return { newState: state, result: { success: false, message: 'Cannot build on forest tiles' } };
  }
  if (tile.hasMetalDeposit) {
    return { newState: state, result: { success: false, message: 'Cannot build on metal deposits' } };
  }
  if (tile.hasOilDeposit) {
    return { newState: state, result: { success: false, message: 'Cannot build on oil deposits' } };
  }
  if (tile.building) {
    return { newState: state, result: { success: false, message: 'Tile already has a building' } };
  }

  // Check building size fits - ALL tiles must be buildable
  for (let dy = 0; dy < stats.size.height; dy++) {
    for (let dx = 0; dx < stats.size.width; dx++) {
      const checkTile = state.grid[y + dy]?.[x + dx];
      if (!checkTile) {
        return { newState: state, result: { success: false, message: `Building footprint doesn't fit at (${x}, ${y}) - tile (${x+dx}, ${y+dy}) is out of bounds` } };
      }
      if (checkTile.terrain === 'water') {
        return { newState: state, result: { success: false, message: `Cannot build at (${x}, ${y}) - tile (${x+dx}, ${y+dy}) is water` } };
      }
      if (checkTile.building) {
        return { newState: state, result: { success: false, message: `Cannot build at (${x}, ${y}) - tile (${x+dx}, ${y+dy}) already has a building` } };
      }
      if (checkTile.forestDensity > 0) {
        return { newState: state, result: { success: false, message: `Cannot build at (${x}, ${y}) - tile (${x+dx}, ${y+dy}) has trees` } };
      }
      if (checkTile.hasMetalDeposit) {
        return { newState: state, result: { success: false, message: `Cannot build at (${x}, ${y}) - tile (${x+dx}, ${y+dy}) is a metal deposit` } };
      }
      if (checkTile.hasOilDeposit) {
        return { newState: state, result: { success: false, message: `Cannot build at (${x}, ${y}) - tile (${x+dx}, ${y+dy}) is an oil deposit` } };
      }
    }
  }

  // Check territory (except for city_center which expands territory)
  const cityCenters = extractCityCenters(state.grid, state.gridSize);
  const territoryOwner = getTerritoryOwner(state.grid, state.gridSize, x, y, cityCenters);
  if (bType !== 'city_center' && territoryOwner !== aiPlayerId) {
    return { newState: state, result: { success: false, message: 'Can only build within your territory' } };
  }

  // CRITICAL: Validate resource adjacency for economic buildings
  if (bType === 'woodcutters_camp') {
    let nearForest = false;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const adj = state.grid[y + dy]?.[x + dx];
        if (adj && (adj.forestDensity > 0 || adj.terrain === 'forest')) {
          nearForest = true;
          break;
        }
      }
      if (nearForest) break;
    }
    if (!nearForest) {
      return { newState: state, result: { success: false, message: `woodcutters_camp at (${x},${y}) is NOT near forest! Use tiles from "🌲 For woodcutters_camp" list!` } };
    }
  }
  
  if (bType === 'mine') {
    let nearMetal = false;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const adj = state.grid[y + dy]?.[x + dx];
        if (adj && adj.hasMetalDeposit) {
          nearMetal = true;
          break;
        }
      }
      if (nearMetal) break;
    }
    if (!nearMetal) {
      return { newState: state, result: { success: false, message: `mine at (${x},${y}) is NOT near metal! Use tiles from "⛏️ For mine" list!` } };
    }
  }

  // Check minimum distance between SAME TYPE of resource extraction buildings (3 tiles)
  // Only applies to mines, forests, and oil - farms can be placed anywhere
  const RESOURCE_GATHERING_BUILDINGS: RoNBuildingType[] = [
    'woodcutters_camp', 'lumber_mill', 'mine', 'smelter',
    'oil_well', 'oil_platform', 'refinery'
  ];
  const RESOURCE_BUILDING_MIN_DISTANCE = 3;
  
  if (RESOURCE_GATHERING_BUILDINGS.includes(bType)) {
    // Search for other buildings of the SAME TYPE within minimum distance
    for (let dy = -RESOURCE_BUILDING_MIN_DISTANCE; dy <= RESOURCE_BUILDING_MIN_DISTANCE; dy++) {
      for (let dx = -RESOURCE_BUILDING_MIN_DISTANCE; dx <= RESOURCE_BUILDING_MIN_DISTANCE; dx++) {
        if (dx === 0 && dy === 0) continue;
        
        const checkX = x + dx;
        const checkY = y + dy;
        if (checkX < 0 || checkX >= state.gridSize || checkY < 0 || checkY >= state.gridSize) continue;
        
        const checkTile = state.grid[checkY]?.[checkX];
        if (!checkTile?.building) continue;
        
        const existingBuildingType = checkTile.building.type as RoNBuildingType;
        // Only check against the SAME building type
        if (existingBuildingType === bType) {
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < RESOURCE_BUILDING_MIN_DISTANCE) {
            return { 
              newState: state, 
              result: { 
                success: false, 
                message: `${bType} at (${x},${y}) is too close to another ${bType} at (${checkX},${checkY})! Same type of resource building must be at least 3 tiles apart.` 
              } 
            };
          }
        }
      }
    }
  }

  // Deduct resources
  const newResources = { ...player.resources };
  for (const [resource, amount] of Object.entries(stats.cost)) {
    if (amount) {
      newResources[resource as ResourceType] -= amount;
    }
  }

  // Create building
  const newBuilding = {
    type: bType,
    level: 1,
    ownerId: aiPlayerId,
    health: stats.maxHealth,
    maxHealth: stats.maxHealth,
    // Economic buildings and small military buildings are instant for AI, others need construction
    constructionProgress: ['farm', 'dock', 'woodcutters_camp', 'mine', 'barracks'].includes(bType) ? 100 : 0,
    queuedUnits: [] as string[],
    productionProgress: 0,
    garrisonedUnits: [] as string[],
  };

  // Update grid
  const newGrid = state.grid.map((row, gy) =>
    row.map((t, gx) => {
      if (gx >= x && gx < x + stats.size.width && gy >= y && gy < y + stats.size.height) {
        return {
          ...t,
          building: gx === x && gy === y ? newBuilding : null,
          ownerId: aiPlayerId,
        };
      }
      return t;
    })
  );

  const newPlayers = state.players.map(p =>
    p.id === aiPlayerId ? { ...p, resources: newResources } : p
  );

  // Verify the building was placed
  const verifyTile = newGrid[y]?.[x];
  console.log(`[BUILD] Placed ${buildingType} at (${x},${y}), verified: ${verifyTile?.building?.type === bType}, ownerId: ${verifyTile?.ownerId}`);

  return {
    newState: { ...state, grid: newGrid, players: newPlayers },
    result: { success: true, message: `Built ${buildingType} at (${x}, ${y})` },
  };
}

/**
 * Validate and execute unit creation
 */
export function executeCreateUnit(
  state: RoNGameState,
  aiPlayerId: string,
  unitType: string,
  buildingX: number,
  buildingY: number
): { newState: RoNGameState; result: ToolResult } {
  const player = state.players.find(p => p.id === aiPlayerId);
  if (!player) {
    return { newState: state, result: { success: false, message: 'AI player not found' } };
  }

  const uType = unitType as UnitType;
  const baseStats = UNIT_STATS[uType];
  if (!baseStats) {
    return { newState: state, result: { success: false, message: `Unknown unit type: ${unitType}` } };
  }

  // Check age requirement
  const ageIndex = AGE_ORDER.indexOf(player.age);
  const requiredAgeIndex = AGE_ORDER.indexOf(baseStats.minAge);
  if (ageIndex < requiredAgeIndex) {
    return { newState: state, result: { success: false, message: `Unit requires ${baseStats.minAge} age` } };
  }

  // Get age-scaled stats (costs scale with age for military units!)
  const unitStats = getUnitStatsForAge(uType, player.age);

  // Check population cap
  if (player.population >= player.populationCap) {
    return { newState: state, result: { success: false, message: 'Population cap reached' } };
  }

  // Check resources (using age-scaled cost)
  for (const [resource, amount] of Object.entries(unitStats.cost)) {
    if (amount && player.resources[resource as ResourceType] < amount) {
      return { newState: state, result: { success: false, message: `Not enough ${resource}` } };
    }
  }

  // Find building
  const tile = state.grid[buildingY]?.[buildingX];
  if (!tile?.building || tile.building.ownerId !== aiPlayerId) {
    return { newState: state, result: { success: false, message: `No owned building at (${buildingX}, ${buildingY})` } };
  }

  // Check if building can produce this unit
  const producibleUnits = UNIT_PRODUCTION_BUILDINGS[tile.building.type as RoNBuildingType];
  if (!producibleUnits?.includes(unitType)) {
    return { newState: state, result: { success: false, message: `${tile.building.type} cannot produce ${unitType}` } };
  }

  // Check queue capacity
  if (tile.building.queuedUnits.length >= 5) {
    return { newState: state, result: { success: false, message: 'Production queue is full' } };
  }

  // Deduct resources
  const newResources = { ...player.resources };
  for (const [resource, amount] of Object.entries(unitStats.cost)) {
    if (amount) {
      newResources[resource as ResourceType] -= amount;
    }
  }

  // Add to queue
  const newGrid = state.grid.map((row, gy) =>
    row.map((t, gx) => {
      if (gx === buildingX && gy === buildingY && t.building) {
        return {
          ...t,
          building: {
            ...t.building,
            queuedUnits: [...t.building.queuedUnits, unitType],
          },
        };
      }
      return t;
    })
  );

  const newPlayers = state.players.map(p =>
    p.id === aiPlayerId ? { ...p, resources: newResources } : p
  );

  return {
    newState: { ...state, grid: newGrid, players: newPlayers },
    result: { success: true, message: `Queued ${unitType} for production at (${buildingX}, ${buildingY})` },
  };
}

/**
 * Validate and execute unit movement/task assignment
 */
export function executeSendUnits(
  state: RoNGameState,
  aiPlayerId: string,
  unitIds: string[],
  targetX: number,
  targetY: number,
  task: string
): { newState: RoNGameState; result: ToolResult } {
  const validTasks = ['move', 'attack', 'gather_food', 'gather_wood', 'gather_metal', 'gather_gold', 'gather_oil', 'gather_knowledge', 'build'];
  if (!validTasks.includes(task)) {
    return { newState: state, result: { success: false, message: `Invalid task: ${task}` } };
  }

  // Find units owned by AI (handle various ID formats the AI might use)
  // AI sometimes sends "militia[unit-xxx]" instead of just "unit-xxx"
  const normalizedIds = unitIds.map(id => {
    // Extract unit ID from formats like "militia[unit-xxx]" or "unit-xxx"
    const match = id.match(/unit-[a-z0-9-]+/i);
    return match ? match[0] : id;
  });
  console.log(`[send_units] Normalized IDs: ${normalizedIds.join(', ')}`);
  
  const unitsToMove = state.units.filter(u => normalizedIds.includes(u.id) && u.ownerId === aiPlayerId);
  if (unitsToMove.length === 0) {
    console.log(`[send_units] No matching units. AI units: ${state.units.filter(u => u.ownerId === aiPlayerId).map(u => u.id).join(', ')}`);
    return { newState: state, result: { success: false, message: 'No valid units found with those IDs' } };
  }

  // Update units with formation spreading
  const numUnits = unitsToMove.length;
  let unitIndex = 0;
  
  const newUnits = state.units.map(u => {
    if (normalizedIds.includes(u.id) && u.ownerId === aiPlayerId) {
      // Calculate formation offset
      let offsetX = 0;
      let offsetY = 0;
      if (numUnits > 1) {
        const spreadRadius = 0.6;
        if (unitIndex === 0) {
          offsetX = 0;
          offsetY = 0;
        } else {
          const angle = (unitIndex - 1) * (Math.PI * 2 / Math.max(1, numUnits - 1));
          const ring = Math.floor((unitIndex - 1) / 6) + 1;
          offsetX = Math.cos(angle) * spreadRadius * ring;
          offsetY = Math.sin(angle) * spreadRadius * ring;
        }
      }
      unitIndex++;

      return {
        ...u,
        task: task as Unit['task'],
        taskTarget: { x: targetX, y: targetY },
        targetX: targetX + offsetX,
        targetY: targetY + offsetY,
        isMoving: true,
        idleSince: undefined,
      };
    }
    return u;
  });

  return {
    newState: { ...state, units: newUnits },
    result: { success: true, message: `Sent ${unitsToMove.length} units to (${targetX}, ${targetY}) with task: ${task}` },
  };
}

/**
 * Execute age advancement
 */
export function executeAdvanceAge(
  state: RoNGameState,
  aiPlayerId: string
): { newState: RoNGameState; result: ToolResult } {
  const player = state.players.find(p => p.id === aiPlayerId);
  if (!player) {
    return { newState: state, result: { success: false, message: 'AI player not found' } };
  }

  const currentAgeIndex = AGE_ORDER.indexOf(player.age);
  if (currentAgeIndex >= AGE_ORDER.length - 1) {
    return { newState: state, result: { success: false, message: 'Already at maximum age' } };
  }

  const nextAge = AGE_ORDER[currentAgeIndex + 1];
  const requirements = AGE_REQUIREMENTS[nextAge];
  if (!requirements) {
    return { newState: state, result: { success: false, message: 'No requirements defined for next age' } };
  }

  // Check ALL resources and report what's missing
  const missing: string[] = [];
  const status: string[] = [];
  for (const [resource, amount] of Object.entries(requirements)) {
    const have = Math.floor(player.resources[resource as ResourceType]);
    if (have < amount) {
      missing.push(`${resource}: ${have}/${amount}`);
    }
    status.push(`${resource}: ${have}/${amount}${have >= amount ? '✓' : '✗'}`);
  }
  
  if (missing.length > 0) {
    return { 
      newState: state, 
      result: { 
        success: false, 
        message: `Cannot advance age! Missing: ${missing.join(', ')}. Full status: ${status.join(', ')}. DO NOT call advance_age again until ALL show ✓!` 
      } 
    };
  }

  // Deduct resources
  const newResources = { ...player.resources };
  for (const [resource, amount] of Object.entries(requirements)) {
    newResources[resource as ResourceType] -= amount;
  }

  const newPlayers = state.players.map(p =>
    p.id === aiPlayerId ? { ...p, age: nextAge, resources: newResources } : p
  );

  return {
    newState: { ...state, players: newPlayers },
    result: { success: true, message: `Advanced to ${nextAge} age!` },
  };
}

/**
 * Count workers at a specific building
 */
function countWorkersAtBuilding(units: Unit[], x: number, y: number, ownerId: string): number {
  return units.filter(u => {
    if (u.ownerId !== ownerId) return false;
    if (u.type !== 'citizen') return false;
    if (!u.taskTarget) return false;
    // taskTarget can be string or {x, y} - only handle coordinates
    if (typeof u.taskTarget === 'string') return false;
    // Check if worker is targeting this building (within 1 tile)
    const dx = Math.abs(u.taskTarget.x - x);
    const dy = Math.abs(u.taskTarget.y - y);
    return dx <= 1 && dy <= 1 && 
      (u.task === 'gather_food' || u.task === 'gather_wood' || 
       u.task === 'gather_metal' || u.task === 'gather_gold' ||
       u.task === 'gather_knowledge' || u.task === 'gather_oil');
  }).length;
}

/**
 * Reassign a specific worker to gather a resource type.
 * Finds an appropriate building for that resource automatically.
 */
export function executeReassignWorkerToResource(
  state: RoNGameState,
  aiPlayerId: string,
  unitId: string,
  resourceType: string
): { newState: RoNGameState; result: ToolResult } {
  // Find the unit
  const unit = state.units.find(u => u.id === unitId || u.id.endsWith(unitId));
  
  if (!unit) {
    return { newState: state, result: { success: false, message: `Unit ${unitId} not found` } };
  }
  
  if (unit.ownerId !== aiPlayerId) {
    return { newState: state, result: { success: false, message: `Unit ${unitId} is not yours` } };
  }
  
  if (unit.type !== 'citizen') {
    return { newState: state, result: { success: false, message: `Unit ${unitId} is not a citizen (is ${unit.type})` } };
  }
  
  // Map resource type to task
  const resourceToTask: Record<string, string> = {
    'food': 'gather_food',
    'wood': 'gather_wood',
    'metal': 'gather_metal',
    'gold': 'gather_gold',
    'knowledge': 'gather_knowledge',
    'oil': 'gather_oil',
  };
  
  const task = resourceToTask[resourceType];
  if (!task) {
    return { newState: state, result: { success: false, message: `Unknown resource type: ${resourceType}` } };
  }
  
  // Map resource to building types (must match getTaskForBuilding)
  const resourceToBuildings: Record<string, string[]> = {
    'food': ['farm', 'granary'],
    'wood': ['woodcutters_camp', 'lumber_mill'],
    'metal': ['mine', 'smelter'],
    'gold': ['market'],
    'knowledge': ['library', 'university', 'temple'],
    'oil': ['oil_well', 'oil_platform', 'refinery'],
  };
  
  const validBuildingTypes = resourceToBuildings[resourceType] || [];
  
  // Find a building of this type that has room for workers (max 3 per building)
  const MAX_WORKERS_PER_BUILDING = 3;
  let targetBuilding: { x: number; y: number; type: string } | null = null;
  
  for (let y = 0; y < state.gridSize; y++) {
    for (let x = 0; x < state.gridSize; x++) {
      const tile = state.grid[y]?.[x];
      if (!tile?.building) continue;
      if (tile.building.ownerId !== aiPlayerId) continue;
      if (tile.building.constructionProgress !== 100) continue;
      if (!validBuildingTypes.includes(tile.building.type)) continue;
      
      // Count workers at this building
      const workersHere = state.units.filter(u =>
        u.ownerId === aiPlayerId &&
        u.type === 'citizen' &&
        u.taskTarget &&
        typeof u.taskTarget === 'object' &&
        'x' in u.taskTarget &&
        Math.floor(u.taskTarget.x) === x &&
        Math.floor(u.taskTarget.y) === y
      ).length;
      
      if (workersHere < MAX_WORKERS_PER_BUILDING) {
        targetBuilding = { x, y, type: tile.building.type };
        break;
      }
    }
    if (targetBuilding) break;
  }
  
  if (!targetBuilding) {
    return { 
      newState: state, 
      result: { 
        success: false, 
        message: `No ${resourceType} building with available capacity. Build more ${validBuildingTypes.join('/')}!` 
      } 
    };
  }
  
  // Update the unit
  const newUnits = state.units.map(u => {
    if (u.id === unit.id) {
      return {
        ...u,
        task: task as Unit['task'],
        taskTarget: { x: targetBuilding!.x, y: targetBuilding!.y },
        targetX: targetBuilding!.x + (Math.random() - 0.5) * 0.5,
        targetY: targetBuilding!.y + (Math.random() - 0.5) * 0.5,
        isMoving: true,
        idleSince: undefined,
      };
    }
    return u;
  });
  
  const prevTask = unit.task || 'idle';
  console.log(`[assign_workers] Reassigned ${unit.id} from ${prevTask} to ${task} at ${targetBuilding.type} (${targetBuilding.x}, ${targetBuilding.y})`);
  
  return {
    newState: { ...state, units: newUnits },
    result: {
      success: true,
      message: `Reassigned ${unitId} from ${prevTask.replace('gather_', '')} to ${resourceType} at ${targetBuilding.type}`,
    },
  };
}

/**
 * Kill one of your own units (to reduce population or manage resources)
 */
export function executeKillUnit(
  state: RoNGameState,
  playerId: string,
  unitId: string
): { newState: RoNGameState; result: ToolResult } {
  // Find the unit
  const unit = state.units.find(u => u.id === unitId || u.id.endsWith(unitId));
  
  if (!unit) {
    return { newState: state, result: { success: false, message: `Unit ${unitId} not found` } };
  }
  
  if (unit.ownerId !== playerId) {
    return { newState: state, result: { success: false, message: `Unit ${unitId} is not yours` } };
  }
  
  // Remove the unit from the game
  const newUnits = state.units.filter(u => u.id !== unit.id);
  
  // Decrease population if it's a citizen
  let newPlayers = state.players;
  if (unit.type === 'citizen') {
    newPlayers = state.players.map(p => {
      if (p.id === playerId) {
        return { ...p, population: Math.max(0, p.population - 1) };
      }
      return p;
    });
  }
  
  console.log(`[kill_unit] ${playerId} killed their own ${unit.type} (${unit.id})`);
  
  return {
    newState: { ...state, units: newUnits, players: newPlayers },
    result: {
      success: true,
      message: `Killed your ${unit.type}. ${unit.type === 'citizen' ? 'Population decreased by 1.' : ''}`,
    },
  };
}
