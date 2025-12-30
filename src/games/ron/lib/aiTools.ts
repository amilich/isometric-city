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
import type OpenAI from 'openai';

// Tool definitions for OpenAI Responses SDK
export const AI_TOOLS: OpenAI.Responses.Tool[] = [
  {
    type: 'function',
    name: 'refresh_game_state',
    description: 'Refresh and read the current game state. Call this at the start of each turn to get the latest game state. Returns the path to the JSON file containing the full game state.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {},
      required: [] as string[],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'read_game_state',
    description: 'Read the current game state from the JSON file. Returns a condensed view of the game state including your resources, units, buildings, and enemy positions.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {},
      required: [] as string[],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'build_building',
    description: 'Build a building at a specific tile location. The building must be affordable and placeable at the location (within your territory, on valid terrain).',
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        building_type: {
          type: 'string',
          description: 'The type of building to construct. Examples: farm, barracks, library, mine, city_center, etc.',
        },
        x: {
          type: 'number',
          description: 'The X coordinate (column) of the tile to build on.',
        },
        y: {
          type: 'number',
          description: 'The Y coordinate (row) of the tile to build on.',
        },
      },
      required: ['building_type', 'x', 'y'],
    },
  },
  {
    type: 'function',
    name: 'create_unit',
    description: 'Queue a unit for production at a building. The building must be able to produce this unit type and you must have enough resources.',
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        unit_type: {
          type: 'string',
          description: 'The type of unit to create. Examples: citizen, militia, hoplite, archer, light_cavalry, etc.',
        },
        building_x: {
          type: 'number',
          description: 'The X coordinate of the building that will produce the unit.',
        },
        building_y: {
          type: 'number',
          description: 'The Y coordinate of the building that will produce the unit.',
        },
      },
      required: ['unit_type', 'building_x', 'building_y'],
    },
  },
  {
    type: 'function',
    name: 'send_units',
    description: 'Send one or more units to a target location. Can be used for movement, attack, or gathering tasks.',
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        unit_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of unit IDs to send.',
        },
        target_x: {
          type: 'number',
          description: 'The X coordinate of the target location.',
        },
        target_y: {
          type: 'number',
          description: 'The Y coordinate of the target location.',
        },
        task: {
          type: 'string',
          enum: ['move', 'attack', 'gather_food', 'gather_wood', 'gather_metal', 'gather_gold', 'gather_oil', 'gather_knowledge', 'build'],
          description: 'The task for the units to perform at the target.',
        },
      },
      required: ['unit_ids', 'target_x', 'target_y', 'task'],
    },
  },
  {
    type: 'function',
    name: 'send_message',
    description: 'Send a message to the opposing player. Use this to taunt, negotiate, or communicate strategy. Be creative and engaging!',
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        message: {
          type: 'string',
          description: 'The message to send to the opposing player.',
        },
      },
      required: ['message'],
    },
  },
  {
    type: 'function',
    name: 'advance_age',
    description: 'Attempt to advance to the next age. Requires sufficient resources (food, wood, gold, knowledge depending on age).',
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {},
      required: [] as string[],
    },
  },
  {
    type: 'function',
    name: 'assign_workers',
    description: 'Automatically assign idle citizens AND rebalance existing workers to economic buildings based on need. Will move workers FROM resources you have plenty of TO resources you need (e.g., move farm workers to markets when saving for city). Prioritizes based on current resource rates and game state. USE IT EVERY TURN!',
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {},
      required: [] as string[],
    },
  },
  {
    type: 'function',
    name: 'reassign_worker',
    description: 'Reassign a specific citizen worker to a different task. Use this to manually control which resources your workers gather. Works on ANY citizen, not just idle ones.',
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        unit_id: {
          type: 'string',
          description: 'The ID of the citizen to reassign (e.g., "u123" or "player-1-citizen-0")',
        },
        target_x: {
          type: 'number',
          description: 'X coordinate of the building to work at',
        },
        target_y: {
          type: 'number',
          description: 'Y coordinate of the building to work at',
        },
      },
      required: ['unit_id', 'target_x', 'target_y'],
    },
  },
  {
    type: 'function',
    name: 'wait_ticks',
    description: 'Wait for a specified number of game ticks before taking the next action. Use this to let the economy build up or wait for units to be produced.',
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        ticks: {
          type: 'number',
          description: 'Number of game ticks to wait (1-100).',
        },
      },
      required: ['ticks'],
    },
  },
];

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
    barracksCount: number;
  };
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
      for (const b of myBuildings) {
        if (b.type === 'farm') farmCount++;
        else if (b.type === 'woodcutters_camp') woodcutterCount++;
        else if (b.type === 'mine') mineCount++;
        else if (b.type === 'barracks') barracksCount++;
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
        barracksCount,
      };
    })(),
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

  // Check resources
  for (const [resource, amount] of Object.entries(requirements)) {
    if (player.resources[resource as ResourceType] < amount) {
      return { newState: state, result: { success: false, message: `Not enough ${resource}. Need ${amount}, have ${player.resources[resource as ResourceType]}` } };
    }
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
 * Get the task type for an economic building
 */
function getTaskForBuilding(buildingType: RoNBuildingType): string | null {
  switch (buildingType) {
    case 'farm':
    case 'granary':
      return 'gather_food';
    case 'woodcutters_camp':
    case 'lumber_mill':
      return 'gather_wood';
    case 'mine':
    case 'smelter':
      return 'gather_metal';
    case 'market':
      return 'gather_gold';
    case 'library':
    case 'university':
      return 'gather_knowledge';
    case 'oil_well':
    case 'oil_platform':
    case 'refinery':
      return 'gather_oil';
    default:
      return null;
  }
}

/**
 * Automatically assign idle/moving citizens to economic buildings
 * AND rebalance workers from over-saturated food to other resources
 */
export function executeAssignIdleWorkers(
  state: RoNGameState,
  aiPlayerId: string
): { newState: RoNGameState; result: ToolResult } {
  const player = state.players.find(p => p.id === aiPlayerId);
  if (!player) {
    return { newState: state, result: { success: false, message: 'AI player not found' } };
  }

  // First, detect and fix stuck workers (gather task but no valid target)
  // These workers are useless - they have a task but aren't actually working
  const stuckWorkers = state.units.filter(u => {
    if (u.ownerId !== aiPlayerId || u.type !== 'citizen') return false;
    const hasGatherTask = u.task?.startsWith('gather_');
    const hasValidTarget = u.taskTarget && typeof u.taskTarget === 'object' && 'x' in u.taskTarget;
    return hasGatherTask && !hasValidTarget && !u.isMoving;
  });
  
  if (stuckWorkers.length > 0) {
    console.log(`[assign_workers] Found ${stuckWorkers.length} STUCK workers with gather task but no target - treating as idle`);
  }

  // Find idle or moving citizens, INCLUDING stuck workers
  let idleCitizens = state.units.filter(u =>
    u.ownerId === aiPlayerId &&
    u.type === 'citizen' &&
    (u.task === 'idle' || u.task === 'move' || stuckWorkers.some(sw => sw.id === u.id))
  );

  // SMART REBALANCING: If food rate is high but wood/metal/gold rate is 0, reassign some farmers
  const foodRate = player.resourceRates.food;
  const woodRate = player.resourceRates.wood;
  const metalRate = player.resourceRates.metal;
  const goldRate = player.resourceRates.gold;
  // Pop cap check for gold prioritization
  const popCapped = player.population >= player.populationCap;
  const needsGoldForCity = popCapped && player.resources.gold < 200;
  const needsWoodForCity = popCapped && player.resources.wood < 400;
  
  // Check excess resources - if we have enough food (200+), workers can be reassigned to wood
  // 200 food = can train ~3 citizens if needed, safe buffer
  const hasExcessFood = player.resources.food > 200;

  // Check if we have buildings but no production
  const hasWoodBuilding = state.grid.flat().some(t =>
    t?.building?.ownerId === aiPlayerId &&
    t?.building?.type === 'woodcutters_camp' &&
    t?.building?.constructionProgress === 100
  );
  const hasMineBuilding = state.grid.flat().some(t =>
    t?.building?.ownerId === aiPlayerId &&
    t?.building?.type === 'mine' &&
    t?.building?.constructionProgress === 100
  );
  const hasMarketBuilding = state.grid.flat().some(t =>
    t?.building?.ownerId === aiPlayerId &&
    t?.building?.type === 'market' &&
    t?.building?.constructionProgress === 100
  );
  const hasFarmBuilding = state.grid.flat().some(t =>
    t?.building?.ownerId === aiPlayerId &&
    t?.building?.type === 'farm' &&
    t?.building?.constructionProgress === 100
  );

  // Find farmers to reassign if we have unproductive resource buildings
  // CRITICAL: Also rebalance if food rate is 0 but we have farms!
  // ALSO: Aggressively rebalance to gold/wood when pop-capped and need resources for city!
  const needsRebalance = (hasWoodBuilding && woodRate === 0) ||
                         (hasMineBuilding && metalRate === 0) ||
                         (hasMarketBuilding && needsGoldForCity) || // Rebalance to gold when saving for city
                         (hasWoodBuilding && needsWoodForCity && hasExcessFood) || // WOOD FOR CITY - move excess food workers!
                         (hasFarmBuilding && foodRate === 0); // FOOD IS CRITICAL!
  console.log(`[assign_workers] Checking rebalance: idleCount=${idleCitizens.length}, hasFarm=${hasFarmBuilding}, foodRate=${foodRate}, hasWood=${hasWoodBuilding}, woodRate=${woodRate}, hasMine=${hasMineBuilding}, metalRate=${metalRate}`);
  if (idleCitizens.length === 0 && needsRebalance) {
    // Find ALL workers (any task) to potentially reassign
    const allWorkers = state.units.filter(u =>
      u.ownerId === aiPlayerId &&
      u.type === 'citizen'
    );
    console.log(`[assign_workers] All workers: ${allWorkers.map(w => `${w.id.slice(-6)}:${w.task}`).join(', ')}`);

    // Find workers on farms OR metal (any resource task) to potentially reassign to wood
    const farmWorkers = state.units.filter(u =>
      u.ownerId === aiPlayerId &&
      u.type === 'citizen' &&
      u.task === 'gather_food'
    );
    const metalWorkers = state.units.filter(u =>
      u.ownerId === aiPlayerId &&
      u.type === 'citizen' &&
      u.task === 'gather_metal'
    );

    // SMART rebalancing: protect food if low, prioritize by actual need
    let workersToReassign: typeof farmWorkers = [];
    let rebalanceTarget: 'food' | 'wood' | 'metal' | 'gold' | null = null;
    const foodIsLow = player.resources.food < 80; // Less than cost of 1 citizen
    const woodIsLow = player.resources.wood < 50;
    
    const woodWorkers = state.units.filter(u =>
      u.ownerId === aiPlayerId &&
      u.type === 'citizen' &&
      u.task === 'gather_wood'
    );
    
    const goldWorkers = state.units.filter(u =>
      u.ownerId === aiPlayerId &&
      u.type === 'citizen' &&
      u.task === 'gather_gold'
    );
    
    console.log(`[assign_workers] Resource status: food=${Math.round(player.resources.food)} (rate=${foodRate.toFixed(2)}), wood=${Math.round(player.resources.wood)} (rate=${woodRate.toFixed(2)}), gold=${Math.round(player.resources.gold)} (rate=${goldRate.toFixed(2)}), workers: food=${farmWorkers.length}, wood=${woodWorkers.length}, metal=${metalWorkers.length}, gold=${goldWorkers.length}`);
    
    // Priority: 
    // 1. WOOD FOR CITY - if pop-capped and need wood with excess food, aggressively move to wood!
    // 2. GOLD FOR CITY - if pop-capped and need gold, move workers to market!
    // 3. FOOD IS MOST IMPORTANT - if food rate is 0 and we have farms, move workers TO food
    // 4. Take from metal first for other needs
    // 5. Only take from food if food is abundant
    
    if (needsWoodForCity && hasWoodBuilding && hasExcessFood && farmWorkers.length >= 2) {
      // CRITICAL: Pop-capped, need WOOD for city, have excess food - move half of food workers to wood!
      const workersToMove = Math.ceil(farmWorkers.length / 2);
      workersToReassign = farmWorkers.slice(0, workersToMove);
      rebalanceTarget = 'wood';
      console.log(`[assign_workers] CRITICAL: Need WOOD for city (have ${Math.round(player.resources.wood)}/400)! Moving ${workersToReassign.length}/${farmWorkers.length} food workers to wood (food=${Math.round(player.resources.food)})`);
    } else if (needsGoldForCity && hasMarketBuilding && goldWorkers.length === 0) {
      // CRITICAL: Need gold for city but no gold workers! Move to market
      if (metalWorkers.length >= 1) {
        workersToReassign = metalWorkers.slice(0, Math.max(1, Math.ceil(metalWorkers.length / 2)));
        rebalanceTarget = 'gold';
        console.log(`[assign_workers] CRITICAL: Need gold for city! Moving ${workersToReassign.length} workers from METAL to gold`);
      } else if (farmWorkers.length >= 2 && !foodIsLow) {
        workersToReassign = farmWorkers.slice(0, 1);
        rebalanceTarget = 'gold';
        console.log(`[assign_workers] CRITICAL: Need gold for city! Moving 1 worker from FOOD to gold`);
      } else if (woodWorkers.length >= 2 && !woodIsLow) {
        workersToReassign = woodWorkers.slice(0, 1);
        rebalanceTarget = 'gold';
        console.log(`[assign_workers] CRITICAL: Need gold for city! Moving 1 worker from WOOD to gold`);
      }
    } else if (foodRate === 0 && hasFarmBuilding && farmWorkers.length === 0) {
      // CRITICAL: No food income! Move workers TO food from wood or metal
      if (woodWorkers.length >= 1) {
        workersToReassign = woodWorkers.slice(0, Math.max(1, Math.ceil(woodWorkers.length / 2)));
        rebalanceTarget = 'food';
        console.log(`[assign_workers] CRITICAL: No food income! Moving ${workersToReassign.length} workers from WOOD to food`);
      } else if (metalWorkers.length >= 1) {
        workersToReassign = metalWorkers.slice(0, Math.max(1, Math.ceil(metalWorkers.length / 2)));
        rebalanceTarget = 'food';
        console.log(`[assign_workers] CRITICAL: No food income! Moving ${workersToReassign.length} workers from METAL to food`);
      }
    } else if (woodRate === 0 && metalWorkers.length >= 1) {
      // Need wood, take from metal first
      workersToReassign = metalWorkers.slice(0, Math.max(1, Math.ceil(metalWorkers.length / 2)));
      console.log(`[assign_workers] Rebalancing: moving ${workersToReassign.length} workers from METAL to wood`);
    } else if (metalRate === 0 && hasMineBuilding && metalWorkers.length === 0 && farmWorkers.length >= 2 && !foodIsLow) {
      // Need metal, have mine but no metal workers, and food is ok - take from food
      workersToReassign = farmWorkers.slice(0, 1);
      console.log(`[assign_workers] Rebalancing: moving 1 worker from FOOD to metal (food ok: ${Math.round(player.resources.food)})`);
    } else if (woodRate === 0 && hasWoodBuilding && farmWorkers.length >= 3 && !foodIsLow) {
      // Need wood badly, have woodcutters but no income, food is ok - take from food
      workersToReassign = farmWorkers.slice(0, 1);
      console.log(`[assign_workers] Rebalancing: moving 1 worker from FOOD to wood (food ok: ${Math.round(player.resources.food)})`);
    } else if (foodIsLow && foodRate === 0) {
      // Food is critically low - DON'T rebalance, let priority system handle it
      console.log(`[assign_workers] NOT rebalancing - food is critically low (${Math.round(player.resources.food)}) and no income!`);
    }

    if (workersToReassign.length > 0) {
      // Convert them to "idle" temporarily so they get assigned to wood/metal
      idleCitizens = workersToReassign.map(u => ({ ...u, task: 'idle' as const, taskTarget: undefined }));
    } else {
      console.log(`[assign_workers] No workers to rebalance (farmWorkers: ${farmWorkers.length}, metalWorkers: ${metalWorkers.length})`);
    }
  }

  if (idleCitizens.length === 0) {
    return { newState: state, result: { success: true, message: 'No idle workers to assign', data: { assigned: 0 } } };
  }

  // Find economic buildings with capacity
  const economicBuildings: Array<{
    type: RoNBuildingType;
    x: number;
    y: number;
    task: string;
    priority: number; // Higher = more important
    currentWorkers: number;
    maxWorkers: number;
  }> = [];

  // DYNAMIC resource priority based on current rates and game state
  // If a resource rate is 0, that resource gets HIGHEST priority
  const baseResourcePriority: Record<string, number> = {
    'gather_food': 100,
    'gather_wood': 80,
    'gather_metal': 60,
    'gather_gold': 40,
    'gather_knowledge': 20,
    'gather_oil': 10,
  };
  
  // Boost priority for resources with 0 production rate
  const resourcePriority: Record<string, number> = { ...baseResourcePriority };
  if (player.resourceRates.wood === 0) {
    resourcePriority['gather_wood'] = 200; // Highest priority!
  }
  if (player.resourceRates.metal === 0) {
    resourcePriority['gather_metal'] = 150;
  }
  if (player.resourceRates.food === 0) {
    resourcePriority['gather_food'] = 200;
  }
  
  // CRITICAL: Boost wood priority when pop-capped and need wood for small_city!
  if (popCapped && needsWoodForCity) {
    resourcePriority['gather_wood'] = 300; // HIGHEST priority when saving for city!
    console.log(`[assign_workers] BOOSTING WOOD PRIORITY - pop capped and need 400 wood (have ${Math.round(player.resources.wood)})`);
  }
  
  // CRITICAL: Boost gold priority when pop-capped and need gold for small_city!
  if (popCapped && needsGoldForCity) {
    resourcePriority['gather_gold'] = 250; // High priority when saving for city!
    console.log(`[assign_workers] BOOSTING GOLD PRIORITY - pop capped and need 200 gold (have ${Math.round(player.resources.gold)})`);
  } else if (player.resourceRates.gold === 0) {
    resourcePriority['gather_gold'] = 120; // Boost if no gold income
  }
  
  // INDUSTRIAL AGE+: Boost oil priority when we have oil wells
  const isIndustrialPlus = ['industrial', 'modern'].includes(player.age);
  if (isIndustrialPlus) {
    // Check if we have any oil infrastructure
    let hasOilBuildings = false;
    for (let y = 0; y < state.gridSize; y++) {
      for (let x = 0; x < state.gridSize; x++) {
        const tile = state.grid[y]?.[x];
        if (tile?.building?.ownerId === aiPlayerId && 
            ['oil_well', 'oil_platform', 'refinery'].includes(tile.building.type)) {
          hasOilBuildings = true;
          break;
        }
      }
      if (hasOilBuildings) break;
    }
    
    if (hasOilBuildings) {
      // Boost oil gathering priority at Industrial age
      if (player.resourceRates.oil === 0) {
        resourcePriority['gather_oil'] = 180; // High priority if no oil income but have buildings
        console.log(`[assign_workers] BOOSTING OIL PRIORITY - Industrial age with oil buildings but 0 rate`);
      } else {
        resourcePriority['gather_oil'] = 80; // Normal boost at Industrial age
      }
    }
  }

  // Scan for economic buildings
  for (let y = 0; y < state.gridSize; y++) {
    for (let x = 0; x < state.gridSize; x++) {
      const tile = state.grid[y]?.[x];
      if (!tile?.building || tile.building.ownerId !== aiPlayerId) continue;
      if (tile.building.constructionProgress < 100) continue;

      const buildingType = tile.building.type as RoNBuildingType;
      if (!ECONOMIC_BUILDINGS.includes(buildingType)) continue;

      const task = getTaskForBuilding(buildingType);
      if (!task) continue;

      const stats = BUILDING_STATS[buildingType];
      const maxWorkers = stats?.maxWorkers ?? 5;
      const currentWorkers = countWorkersAtBuilding(state.units, x, y, aiPlayerId);

      if (currentWorkers < maxWorkers) {
        economicBuildings.push({
          type: buildingType,
          x,
          y,
          task,
          priority: resourcePriority[task] || 0,
          currentWorkers,
          maxWorkers,
        });
      }
    }
  }

  if (economicBuildings.length === 0) {
    return { newState: state, result: { success: true, message: 'No economic buildings with capacity', data: { assigned: 0 } } };
  }

  // Sort buildings by priority (food first) and then by how empty they are
  economicBuildings.sort((a, b) => {
    const aPct = a.currentWorkers / a.maxWorkers;
    const bPct = b.currentWorkers / b.maxWorkers;
    // Prioritize by resource type first, then by emptiness
    if (a.priority !== b.priority) return b.priority - a.priority;
    return aPct - bPct;
  });

  // Assign workers
  let assigned = 0;
  const newUnits = [...state.units];
  
  // Sort buildings by priority (highest first) before assigning
  economicBuildings.sort((a, b) => b.priority - a.priority);
  
  for (const citizen of idleCitizens) {
    // Find highest priority building with capacity
    const bestBuilding = economicBuildings.find(b => b.currentWorkers < b.maxWorkers);
    
    if (!bestBuilding) break;

    // Update the unit
    const unitIndex = newUnits.findIndex(u => u.id === citizen.id);
    if (unitIndex >= 0) {
      newUnits[unitIndex] = {
        ...newUnits[unitIndex],
        task: bestBuilding.task as Unit['task'],
        taskTarget: { x: bestBuilding.x, y: bestBuilding.y },
        targetX: bestBuilding.x + (Math.random() - 0.5) * 0.5,
        targetY: bestBuilding.y + (Math.random() - 0.5) * 0.5,
        isMoving: true,
        idleSince: undefined,
      };
      bestBuilding.currentWorkers++;
      assigned++;
    }
  }

  const tasksSummary = economicBuildings
    .filter(b => b.currentWorkers > 0)
    .slice(0, 5)
    .map(b => `${b.task.replace('gather_', '')}@${b.x},${b.y}`)
    .join(', ');

  // Log unit task changes for debugging - only show THIS player's units
  if (assigned > 0) {
    console.log(`[assign_workers] Updated ${assigned} units for player ${aiPlayerId}:`);
    newUnits
      .filter(u => u.ownerId === aiPlayerId && u.task?.startsWith('gather_'))
      .slice(0, 5)
      .forEach(u => {
        console.log(`  - Unit ${u.id.slice(0,8)}: task=${u.task}, isMoving=${u.isMoving}, target=(${u.targetX?.toFixed(1)},${u.targetY?.toFixed(1)})`);
      });
  }

  return {
    newState: { ...state, units: newUnits },
    result: {
      success: true,
      message: `Assigned ${assigned} workers. Tasks: ${tasksSummary || 'none'}`,
      data: { assigned, buildings: economicBuildings.length },
    },
  };
}

/**
 * Reassign a specific worker to a new building/task
 */
export function executeReassignWorker(
  state: RoNGameState,
  aiPlayerId: string,
  unitId: string,
  targetX: number,
  targetY: number
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
  
  // Find the building at target location
  const tile = state.grid[Math.floor(targetY)]?.[Math.floor(targetX)];
  
  // Also check nearby tiles for multi-tile buildings
  let buildingTile = tile;
  if (!tile?.building) {
    // Check in a small area for building origins
    for (let dy = 0; dy < 3; dy++) {
      for (let dx = 0; dx < 3; dx++) {
        const checkTile = state.grid[Math.floor(targetY) - dy]?.[Math.floor(targetX) - dx];
        if (checkTile?.building && checkTile.building.ownerId === aiPlayerId) {
          buildingTile = checkTile;
          break;
        }
      }
      if (buildingTile?.building) break;
    }
  }
  
  if (!buildingTile?.building) {
    return { newState: state, result: { success: false, message: `No building found at (${targetX}, ${targetY})` } };
  }
  
  if (buildingTile.building.ownerId !== aiPlayerId) {
    return { newState: state, result: { success: false, message: `Building at (${targetX}, ${targetY}) is not yours` } };
  }
  
  // Determine the task for this building
  const task = getTaskForBuilding(buildingTile.building.type as RoNBuildingType);
  
  if (!task) {
    return { newState: state, result: { success: false, message: `Building ${buildingTile.building.type} doesn't support worker assignment` } };
  }
  
  // Update the unit
  const newUnits = state.units.map(u => {
    if (u.id === unit.id) {
      return {
        ...u,
        task: task as Unit['task'],
        taskTarget: { x: targetX, y: targetY },
        targetX: targetX + (Math.random() - 0.5) * 0.5,
        targetY: targetY + (Math.random() - 0.5) * 0.5,
        isMoving: true,
        idleSince: undefined,
      };
    }
    return u;
  });
  
  console.log(`[reassign_worker] Reassigned ${unit.id} from ${unit.task || 'idle'} to ${task} at (${targetX}, ${targetY})`);
  
  return {
    newState: { ...state, units: newUnits },
    result: {
      success: true,
      message: `Reassigned worker to ${task.replace('gather_', '')} at (${targetX}, ${targetY})`,
    },
  };
}
