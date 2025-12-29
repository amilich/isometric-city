/**
 * Rise of Nations - Agentic AI Tools
 * 
 * Tool definitions for the OpenAI Responses SDK agentic AI.
 * These tools allow the AI to interact with the game state.
 */

import { RoNGameState, RoNPlayer, RoNTile } from '../types/game';
import { RoNBuildingType, BUILDING_STATS, UNIT_PRODUCTION_BUILDINGS, ECONOMIC_BUILDINGS } from '../types/buildings';
import { UnitType, UNIT_STATS, Unit } from '../types/units';
import { AGE_ORDER, AGE_REQUIREMENTS } from '../types/ages';
import { ResourceType } from '../types/resources';
import { getTerritoryOwner, extractCityCenters } from './simulation';
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
    name: 'assign_idle_workers',
    description: 'Automatically assign all idle or moving citizens to the best available economic buildings. Prioritizes food production, then wood, then other resources. This is a CRITICAL tool - USE IT EVERY TURN to keep your economy running!',
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
  emptyTerritoryTiles: Array<{ x: number; y: number }>; // Empty tiles you can build on
  tilesNearForest: Array<{ x: number; y: number }>; // Good for woodcutters_camp
  tilesNearMetal: Array<{ x: number; y: number }>; // Good for mine
  resourceTiles: {
    forests: Array<{ x: number; y: number; density: number }>;
    metalDeposits: Array<{ x: number; y: number }>;
    oilDeposits: Array<{ x: number; y: number }>;
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
    myUnits: myUnits.slice(0, 20), // Limit to save tokens
    myBuildings: myBuildings.slice(0, 15),
    enemyUnits: enemyUnits.slice(0, 10),
    enemyBuildings: enemyBuildings.slice(0, 10),
    mapSize: state.gridSize,
    availableBuildingTypes,
    availableUnitTypes,
    territoryTiles: territoryTiles.slice(0, 10), // Reduced to save tokens
    emptyTerritoryTiles: territoryTiles
      .filter(t => {
        const tile = state.grid[t.y]?.[t.x];
        if (!tile) return false;
        if (tile.building) return false;
        // Filter out non-buildable terrain
        if (tile.terrain === 'water') return false;
        if (tile.terrain === 'forest') return false;
        if (tile.terrain === 'mountain') return false;
        return true;
      })
      .slice(0, 8), // Empty tiles for building
    // Find tiles ADJACENT to forests (good for woodcutters_camp)
    tilesNearForest: territoryTiles
      .filter(t => {
        const tile = state.grid[t.y]?.[t.x];
        // Must be buildable (no building, not water/forest/mountain, no forestDensity)
        if (!tile || tile.building) return false;
        if (tile.terrain === 'water' || tile.terrain === 'forest' || tile.terrain === 'mountain') return false;
        if (tile.forestDensity > 0) return false; // Can't build on tiles with trees
        if (tile.hasMetalDeposit || tile.hasOilDeposit) return false;
        // Check if adjacent to a forest
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
      })
      .slice(0, 5),
    // Find tiles ADJACENT to metal deposits (good for mine)
    tilesNearMetal: territoryTiles
      .filter(t => {
        const tile = state.grid[t.y]?.[t.x];
        // Must be buildable
        if (!tile || tile.building) return false;
        if (tile.terrain === 'water' || tile.terrain === 'forest' || tile.terrain === 'mountain') return false;
        if (tile.forestDensity > 0 || tile.hasMetalDeposit || tile.hasOilDeposit) return false;
        // Check if adjacent to metal
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
      })
      .slice(0, 5),
    resourceTiles: {
      forests: forests.slice(0, 5),
      metalDeposits: metalDeposits.slice(0, 5),
      oilDeposits: oilDeposits.slice(0, 5),
    },
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

  // Check building size fits
  for (let dy = 0; dy < stats.size.height; dy++) {
    for (let dx = 0; dx < stats.size.width; dx++) {
      const checkTile = state.grid[y + dy]?.[x + dx];
      if (!checkTile || checkTile.terrain === 'water' || checkTile.building) {
        return { newState: state, result: { success: false, message: `Building footprint doesn't fit at (${x}, ${y})` } };
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
  const unitStats = UNIT_STATS[uType];
  if (!unitStats) {
    return { newState: state, result: { success: false, message: `Unknown unit type: ${unitType}` } };
  }

  // Check age requirement
  const ageIndex = AGE_ORDER.indexOf(player.age);
  const requiredAgeIndex = AGE_ORDER.indexOf(unitStats.minAge);
  if (ageIndex < requiredAgeIndex) {
    return { newState: state, result: { success: false, message: `Unit requires ${unitStats.minAge} age` } };
  }

  // Check population cap
  if (player.population >= player.populationCap) {
    return { newState: state, result: { success: false, message: 'Population cap reached' } };
  }

  // Check resources
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

  // Find units owned by AI
  const unitsToMove = state.units.filter(u => unitIds.includes(u.id) && u.ownerId === aiPlayerId);
  if (unitsToMove.length === 0) {
    return { newState: state, result: { success: false, message: 'No valid units found with those IDs' } };
  }

  // Update units with formation spreading
  const numUnits = unitsToMove.length;
  let unitIndex = 0;
  
  const newUnits = state.units.map(u => {
    if (unitIds.includes(u.id) && u.ownerId === aiPlayerId) {
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

  // Find idle or moving citizens
  let idleCitizens = state.units.filter(u =>
    u.ownerId === aiPlayerId &&
    u.type === 'citizen' &&
    (u.task === 'idle' || u.task === 'move')
  );

  // SMART REBALANCING: If food rate is high but wood/metal rate is 0, reassign some farmers
  const foodRate = player.resourceRates.food;
  const woodRate = player.resourceRates.wood;
  const metalRate = player.resourceRates.metal;
  
  // Check if we have a wood/metal building but no production
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
  
  // Find farmers to reassign if we have unproductive resource buildings
  if (idleCitizens.length === 0 && ((hasWoodBuilding && woodRate === 0) || (hasMineBuilding && metalRate === 0))) {
    // Find workers on farms
    const farmWorkers = state.units.filter(u =>
      u.ownerId === aiPlayerId &&
      u.type === 'citizen' &&
      u.task === 'gather_food'
    );
    
    // Take farmers to reassign to wood/metal (keep at least 1 farmer for food)
    if (farmWorkers.length >= 2) {
      // Reassign half of farmers (at least 1) to fix 0 wood/metal rate
      const numToReassign = Math.max(1, Math.floor(farmWorkers.length / 2));
      const toReassign = farmWorkers.slice(0, numToReassign);
      // Convert them to "idle" temporarily so they get assigned to wood/metal
      idleCitizens = toReassign.map(u => ({ ...u, task: 'idle' as const, taskTarget: undefined }));
      console.log(`[assign_workers] Rebalancing: moving ${numToReassign} workers from food to wood/metal`);
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

  // DYNAMIC resource priority based on current rates
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

  // Log unit task changes for debugging
  if (assigned > 0) {
    console.log(`[assign_workers] Updated ${assigned} units with new tasks:`);
    newUnits.filter(u => u.task?.startsWith('gather_')).slice(0, 5).forEach(u => {
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
