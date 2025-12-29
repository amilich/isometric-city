/**
 * Rise of Nations - Advanced AI System
 * 
 * Utility-based AI inspired by Rise of Nations' sophisticated AI.
 * Uses a multi-layer architecture:
 * - Strategic Layer: Long-term goals (expansion, age rushing, military buildup)
 * - Tactical Layer: Medium-term decisions (build orders, unit composition)
 * - Operational Layer: Immediate actions (worker assignment, attack execution)
 */

import { RoNGameState, RoNPlayer, RoNTile } from '../types/game';
import { Age, AGE_ORDER, AGE_REQUIREMENTS } from '../types/ages';
import { ResourceType, Resources, RESOURCE_INFO } from '../types/resources';
import { RoNBuildingType, RoNBuilding, BUILDING_STATS, ECONOMIC_BUILDINGS, UNIT_PRODUCTION_BUILDINGS } from '../types/buildings';
import { Unit, UnitType, UnitTask, UnitStats, UNIT_STATS, UnitCategory } from '../types/units';

// ============================================================================
// AI CONFIGURATION
// ============================================================================

interface AIConfig {
  // Economic targets (ratios)
  targetCitizenRatio: number;          // Citizens as % of population cap
  minFarmsPerCitizen: number;          // Farms needed per 3 citizens
  minWoodcuttersPerCitizen: number;    // Woodcutters per 5 citizens
  minMinesPerAge: number;              // Mines per age level
  
  // Military targets
  targetMilitaryRatio: number;         // Military units as % of citizens
  minDefensiveBuildings: number;       // Minimum towers/forts
  attackThreshold: number;             // Military count before attacking
  
  // Economic thresholds
  lowResourceThreshold: number;        // When a resource is "low"
  abundantResourceThreshold: number;   // When a resource is "abundant"
  
  // Timing (in ticks)
  decisionInterval: number;            // How often to make major decisions
  workerReassignInterval: number;      // How often to rebalance workers
  scoutInterval: number;               // How often to scout
  
  // Expansion
  expandCityDistance: number;          // Min distance for new city centers
  expandWhenPopulationRatio: number;   // Expand when pop > ratio * cap
  
  // Aggression
  raidWhenAdvantage: number;           // Attack when military > enemy * ratio
  defendWhenThreatened: number;        // Build defenses when enemy nearby
}

const AI_CONFIGS: Record<string, AIConfig> = {
  easy: {
    targetCitizenRatio: 0.5,
    minFarmsPerCitizen: 0.25,
    minWoodcuttersPerCitizen: 0.15,
    minMinesPerAge: 1,
    targetMilitaryRatio: 0.6,
    minDefensiveBuildings: 1,
    attackThreshold: 12,
    lowResourceThreshold: 100,
    abundantResourceThreshold: 400,
    decisionInterval: 60,
    workerReassignInterval: 40,
    scoutInterval: 200,
    expandCityDistance: 20,
    expandWhenPopulationRatio: 0.9,
    raidWhenAdvantage: 2.0,
    defendWhenThreatened: 8,
  },
  medium: {
    targetCitizenRatio: 0.6,
    minFarmsPerCitizen: 0.3,
    minWoodcuttersPerCitizen: 0.2,
    minMinesPerAge: 2,
    targetMilitaryRatio: 0.8,
    minDefensiveBuildings: 2,
    attackThreshold: 8,
    lowResourceThreshold: 150,
    abundantResourceThreshold: 500,
    decisionInterval: 40,
    workerReassignInterval: 25,
    scoutInterval: 120,
    expandCityDistance: 18,
    expandWhenPopulationRatio: 0.8,
    raidWhenAdvantage: 1.5,
    defendWhenThreatened: 12,
  },
  hard: {
    targetCitizenRatio: 0.7,
    minFarmsPerCitizen: 0.35,
    minWoodcuttersPerCitizen: 0.25,
    minMinesPerAge: 3,
    targetMilitaryRatio: 1.0,
    minDefensiveBuildings: 3,
    attackThreshold: 5,
    lowResourceThreshold: 200,
    abundantResourceThreshold: 600,
    decisionInterval: 20,
    workerReassignInterval: 15,
    scoutInterval: 80,
    expandCityDistance: 15,
    expandWhenPopulationRatio: 0.7,
    raidWhenAdvantage: 1.2,
    defendWhenThreatened: 15,
  },
};

// ============================================================================
// AI STATE ANALYSIS
// ============================================================================

interface AIAnalysis {
  // Resource status
  resources: Resources;
  resourceRates: Partial<Resources>;   // Estimated income rates
  lowestResource: ResourceType;
  resourcePressure: Record<ResourceType, 'critical' | 'low' | 'ok' | 'abundant'>;
  
  // Population
  totalPopulation: number;
  citizenCount: number;
  militaryCount: number;
  populationCap: number;
  idleCitizens: Unit[];
  idleMilitary: Unit[];
  
  // Buildings
  buildingCounts: Partial<Record<RoNBuildingType, number>>;
  productionBuildings: { pos: { x: number; y: number }; building: RoNBuilding; type: RoNBuildingType }[];
  cityCenters: { x: number; y: number; building: RoNBuilding }[];
  underConstruction: number;
  
  // Territory
  territorySize: number;
  borderTiles: { x: number; y: number }[];
  
  // Enemy analysis
  enemyMilitaryCount: number;
  enemyBuildingCount: number;
  nearestEnemyDistance: number;
  enemyUnitsNearby: Unit[];
  threatenedBuildings: { x: number; y: number; building: RoNBuilding; threats: Unit[] }[];
  
  // Strategic situation
  ageIndex: number;
  canAdvanceAge: boolean;
  ageCost: Partial<Resources> | null;
  militaryAdvantage: number;  // Our military / enemy military
  economicAdvantage: number;  // Our economy / enemy economy
  
  // Map resources
  availableForestTiles: { x: number; y: number }[];
  availableMetalTiles: { x: number; y: number }[];
  availableOilTiles: { x: number; y: number }[];
  uncontestedExpansionSpots: { x: number; y: number }[];
}

const CITY_CENTER_TYPES: RoNBuildingType[] = ['city_center', 'small_city', 'large_city', 'major_city'];
const CITY_CENTER_RADIUS = 24;

function analyzeGameState(state: RoNGameState, player: RoNPlayer, config: AIConfig): AIAnalysis {
  const analysis: AIAnalysis = {
    resources: { ...player.resources },
    resourceRates: {},
    lowestResource: 'food',
    resourcePressure: {
      food: 'ok', wood: 'ok', metal: 'ok', gold: 'ok', knowledge: 'ok', oil: 'ok'
    },
    totalPopulation: player.population,
    citizenCount: 0,
    militaryCount: 0,
    populationCap: player.populationCap,
    idleCitizens: [],
    idleMilitary: [],
    buildingCounts: {},
    productionBuildings: [],
    cityCenters: [],
    underConstruction: 0,
    territorySize: 0,
    borderTiles: [],
    enemyMilitaryCount: 0,
    enemyBuildingCount: 0,
    nearestEnemyDistance: Infinity,
    enemyUnitsNearby: [],
    threatenedBuildings: [],
    ageIndex: AGE_ORDER.indexOf(player.age),
    canAdvanceAge: false,
    ageCost: null,
    militaryAdvantage: 1,
    economicAdvantage: 1,
    availableForestTiles: [],
    availableMetalTiles: [],
    availableOilTiles: [],
    uncontestedExpansionSpots: [],
  };

  // Analyze units
  const playerUnits = state.units.filter(u => u.ownerId === player.id);
  const enemyUnits = state.units.filter(u => u.ownerId !== player.id);
  
  for (const unit of playerUnits) {
    const stats = UNIT_STATS[unit.type];
    if (unit.type === 'citizen') {
      analysis.citizenCount++;
      if (unit.task === 'idle' || !unit.task) {
        analysis.idleCitizens.push(unit);
      }
    } else if (stats.category !== 'civilian') {
      analysis.militaryCount++;
      if (unit.task === 'idle' || !unit.task) {
        analysis.idleMilitary.push(unit);
      }
    }
  }

  // Count enemy military
  for (const unit of enemyUnits) {
    const stats = UNIT_STATS[unit.type];
    if (stats.category !== 'civilian') {
      analysis.enemyMilitaryCount++;
    }
  }

  // Analyze buildings and territory
  let enemyEconomicValue = 0;
  let ourEconomicValue = 0;
  
  for (let y = 0; y < state.gridSize; y++) {
    for (let x = 0; x < state.gridSize; x++) {
      const tile = state.grid[y][x];
      
      // Track our territory and buildings
      if (tile.ownerId === player.id) {
        analysis.territorySize++;
        
        if (tile.building) {
          const buildingType = tile.building.type as RoNBuildingType;
          analysis.buildingCounts[buildingType] = (analysis.buildingCounts[buildingType] || 0) + 1;
          
          if (CITY_CENTER_TYPES.includes(buildingType)) {
            analysis.cityCenters.push({ x, y, building: tile.building });
          }
          
          if (UNIT_PRODUCTION_BUILDINGS[buildingType] && tile.building.constructionProgress >= 100) {
            analysis.productionBuildings.push({ pos: { x, y }, building: tile.building, type: buildingType });
          }
          
          if (tile.building.constructionProgress < 100) {
            analysis.underConstruction++;
          }
          
          // Calculate economic value
          if (ECONOMIC_BUILDINGS.includes(buildingType) || CITY_CENTER_TYPES.includes(buildingType)) {
            ourEconomicValue += BUILDING_STATS[buildingType]?.maxHealth || 1000;
          }
        }
      }
      
      // Track enemy buildings
      if (tile.ownerId && tile.ownerId !== player.id && tile.building) {
        analysis.enemyBuildingCount++;
        const buildingType = tile.building.type as RoNBuildingType;
        if (ECONOMIC_BUILDINGS.includes(buildingType) || CITY_CENTER_TYPES.includes(buildingType)) {
          enemyEconomicValue += BUILDING_STATS[buildingType]?.maxHealth || 1000;
        }
        
        // Calculate distance to enemy
        for (const center of analysis.cityCenters) {
          const dist = Math.sqrt((x - center.x) ** 2 + (y - center.y) ** 2);
          if (dist < analysis.nearestEnemyDistance) {
            analysis.nearestEnemyDistance = dist;
          }
        }
      }
      
      // Track available resource tiles
      if (!tile.building && !tile.ownerId) {
        if (tile.forestDensity > 0) {
          analysis.availableForestTiles.push({ x, y });
        }
        if (tile.hasMetalDeposit) {
          analysis.availableMetalTiles.push({ x, y });
        }
        if (tile.hasOilDeposit && AGE_ORDER.indexOf(player.age) >= AGE_ORDER.indexOf('industrial')) {
          analysis.availableOilTiles.push({ x, y });
        }
      }
    }
  }

  // Check for enemy units near our buildings
  for (const center of analysis.cityCenters) {
    const threats: Unit[] = [];
    for (const enemy of enemyUnits) {
      const dist = Math.sqrt((enemy.x - center.x) ** 2 + (enemy.y - center.y) ** 2);
      if (dist < config.defendWhenThreatened) {
        threats.push(enemy);
        if (!analysis.enemyUnitsNearby.includes(enemy)) {
          analysis.enemyUnitsNearby.push(enemy);
        }
      }
    }
    if (threats.length > 0) {
      analysis.threatenedBuildings.push({ x: center.x, y: center.y, building: center.building, threats });
    }
  }

  // Resource pressure analysis
  let lowestValue = Infinity;
  for (const resource of ['food', 'wood', 'metal', 'gold'] as ResourceType[]) {
    const value = player.resources[resource];
    if (value < config.lowResourceThreshold / 2) {
      analysis.resourcePressure[resource] = 'critical';
    } else if (value < config.lowResourceThreshold) {
      analysis.resourcePressure[resource] = 'low';
    } else if (value > config.abundantResourceThreshold) {
      analysis.resourcePressure[resource] = 'abundant';
    }
    
    if (value < lowestValue) {
      lowestValue = value;
      analysis.lowestResource = resource;
    }
  }

  // Age advancement check
  if (analysis.ageIndex < AGE_ORDER.length - 1) {
    const nextAge = AGE_ORDER[analysis.ageIndex + 1];
    const requirements = AGE_REQUIREMENTS[nextAge];
    if (requirements) {
      analysis.ageCost = requirements;
      analysis.canAdvanceAge = true;
      for (const [resource, amount] of Object.entries(requirements)) {
        if (player.resources[resource as ResourceType] < amount) {
          analysis.canAdvanceAge = false;
          break;
        }
      }
    }
  }

  // Calculate advantages
  analysis.militaryAdvantage = analysis.enemyMilitaryCount > 0 
    ? analysis.militaryCount / analysis.enemyMilitaryCount 
    : analysis.militaryCount > 0 ? 10 : 1;
  
  analysis.economicAdvantage = enemyEconomicValue > 0 
    ? ourEconomicValue / enemyEconomicValue 
    : ourEconomicValue > 0 ? 10 : 1;

  // Find expansion spots
  for (let y = 10; y < state.gridSize - 10; y += 5) {
    for (let x = 10; x < state.gridSize - 10; x += 5) {
      const tile = state.grid[y][x];
      if (tile.terrain === 'grass' && !tile.building && tile.forestDensity === 0 && !tile.hasMetalDeposit) {
        // Check distance from existing cities
        let farEnough = true;
        let tooFarFromUs = true;
        
        for (const center of analysis.cityCenters) {
          const dist = Math.sqrt((x - center.x) ** 2 + (y - center.y) ** 2);
          if (dist < config.expandCityDistance) {
            farEnough = false;
          }
          if (dist < config.expandCityDistance * 2) {
            tooFarFromUs = false;
          }
        }
        
        // Check not too close to enemy
        let nearEnemy = false;
        for (let ey = 0; ey < state.gridSize; ey++) {
          for (let ex = 0; ex < state.gridSize; ex++) {
            const eTile = state.grid[ey][ex];
            if (eTile.ownerId && eTile.ownerId !== player.id && eTile.building) {
              if (CITY_CENTER_TYPES.includes(eTile.building.type as RoNBuildingType)) {
                const dist = Math.sqrt((x - ex) ** 2 + (y - ey) ** 2);
                if (dist < config.expandCityDistance) {
                  nearEnemy = true;
                }
              }
            }
          }
          if (nearEnemy) break;
        }
        
        if (farEnough && !tooFarFromUs && !nearEnemy) {
          analysis.uncontestedExpansionSpots.push({ x, y });
        }
      }
    }
  }

  return analysis;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

interface AIAction {
  type: string;
  priority: number;
  execute: () => RoNGameState;
  description: string;
}

function calculateBuildUtility(
  buildingType: RoNBuildingType,
  analysis: AIAnalysis,
  player: RoNPlayer,
  config: AIConfig
): number {
  const stats = BUILDING_STATS[buildingType];
  if (!stats) return 0;
  
  // Check age requirement
  if (AGE_ORDER.indexOf(stats.minAge) > analysis.ageIndex) return 0;
  
  // Check resources
  for (const [resource, amount] of Object.entries(stats.cost)) {
    if (amount && player.resources[resource as ResourceType] < amount) {
      return 0;
    }
  }
  
  let utility = 0;
  const count = analysis.buildingCounts[buildingType] || 0;
  
  // Economic buildings utility based on need
  switch (buildingType) {
    case 'farm':
      if (analysis.resourcePressure.food === 'critical') utility = 100;
      else if (analysis.resourcePressure.food === 'low') utility = 80;
      else if (count < analysis.citizenCount * config.minFarmsPerCitizen) utility = 60;
      else utility = 20;
      break;
      
    case 'woodcutters_camp':
    case 'lumber_mill':
      if (analysis.resourcePressure.wood === 'critical') utility = 95;
      else if (analysis.resourcePressure.wood === 'low') utility = 75;
      else if (count < analysis.citizenCount * config.minWoodcuttersPerCitizen) utility = 55;
      else utility = 15;
      break;
      
    case 'mine':
    case 'smelter':
      if (analysis.resourcePressure.metal === 'critical') utility = 90;
      else if (analysis.resourcePressure.metal === 'low') utility = 70;
      else if (count < config.minMinesPerAge * (analysis.ageIndex + 1)) utility = 50;
      else utility = 10;
      break;
      
    case 'market':
      if (analysis.resourcePressure.gold === 'critical') utility = 85;
      else if (analysis.resourcePressure.gold === 'low') utility = 65;
      else if (count === 0) utility = 45;
      else utility = 5;
      break;
      
    case 'oil_well':
    case 'refinery':
      if (analysis.ageIndex >= AGE_ORDER.indexOf('industrial')) {
        if (analysis.resourcePressure.oil === 'critical') utility = 80;
        else if (analysis.resourcePressure.oil === 'low') utility = 60;
        else if (count === 0) utility = 40;
        else utility = 10;
      }
      break;
      
    // Knowledge buildings
    case 'library':
      if (count === 0) utility = 70;
      else utility = 10;
      break;
      
    case 'university':
      if (analysis.ageIndex >= 1 && count === 0) utility = 60;
      else utility = 5;
      break;
      
    // Military production
    case 'barracks':
      if (count === 0) utility = 75;
      else if (count === 1 && analysis.militaryCount < analysis.citizenCount * 0.5) utility = 45;
      else if (count < 3) utility = 25;
      else utility = 5;
      break;
      
    case 'stable':
      if (analysis.ageIndex >= 1 && count === 0) utility = 55;
      else if (count < 2) utility = 30;
      else utility = 5;
      break;
      
    case 'siege_factory':
      if (analysis.ageIndex >= 2 && count === 0) utility = 50;
      else utility = 5;
      break;
      
    case 'dock':
      // Only if near water
      if (count === 0) utility = 35;
      else utility = 5;
      break;
      
    case 'airbase':
      if (analysis.ageIndex >= AGE_ORDER.indexOf('modern') && count === 0) utility = 60;
      else utility = 5;
      break;
      
    case 'auto_plant':
    case 'factory':
      if (analysis.ageIndex >= AGE_ORDER.indexOf('industrial') && count === 0) utility = 50;
      else utility = 5;
      break;
      
    // Defensive buildings
    case 'tower':
      if (analysis.enemyUnitsNearby.length > 0 && count < 3) utility = 85;
      else if (count < config.minDefensiveBuildings) utility = 40;
      else utility = 5;
      break;
      
    case 'fort':
    case 'fortress':
      if (analysis.enemyUnitsNearby.length > 3 && count === 0) utility = 70;
      else if (count === 0 && analysis.militaryCount > 10) utility = 35;
      else utility = 5;
      break;
      
    case 'castle':
      if (analysis.ageIndex >= 2 && count === 0 && analysis.militaryAdvantage < 1) utility = 60;
      else utility = 5;
      break;
      
    // City expansion
    case 'city_center':
      if (analysis.totalPopulation > analysis.populationCap * config.expandWhenPopulationRatio) {
        if (analysis.uncontestedExpansionSpots.length > 0) utility = 90;
      } else if (analysis.cityCenters.length === 1 && analysis.economicAdvantage > 1.5) {
        utility = 50;
      }
      break;
  }
  
  // Reduce utility if too many buildings under construction
  if (analysis.underConstruction > 2) {
    utility *= 0.5;
  }
  
  return utility;
}

function calculateTrainUtility(
  unitType: UnitType,
  analysis: AIAnalysis,
  player: RoNPlayer,
  config: AIConfig
): number {
  const stats = UNIT_STATS[unitType];
  if (!stats) return 0;
  
  // Check age requirement
  if (AGE_ORDER.indexOf(stats.minAge) > analysis.ageIndex) return 0;
  
  // Check population cap
  if (analysis.totalPopulation >= analysis.populationCap - 1) return 0;
  
  // Check resources
  for (const [resource, amount] of Object.entries(stats.cost)) {
    if (amount && player.resources[resource as ResourceType] < amount) {
      return 0;
    }
  }
  
  let utility = 0;
  
  switch (unitType) {
    case 'citizen':
      if (analysis.citizenCount < 4) utility = 100;
      else if (analysis.citizenCount < 8) utility = 80;
      else if (analysis.citizenCount < analysis.populationCap * config.targetCitizenRatio) utility = 60;
      else utility = 20;
      
      // Reduce if too many idle citizens
      if (analysis.idleCitizens.length > 3) utility *= 0.5;
      break;
      
    case 'militia':
    case 'hoplite':
    case 'legionary':
      if (analysis.enemyUnitsNearby.length > 0 && analysis.militaryCount < 3) utility = 95;
      else if (analysis.militaryCount < analysis.citizenCount * config.targetMilitaryRatio * 0.3) utility = 70;
      else if (analysis.militaryCount < analysis.citizenCount * config.targetMilitaryRatio) utility = 50;
      else utility = 20;
      break;
      
    case 'archer':
    case 'crossbowman':
    case 'longbowman':
      if (analysis.militaryCount > 3 && analysis.militaryCount < analysis.citizenCount) utility = 55;
      else utility = 25;
      break;
      
    case 'light_cavalry':
    case 'heavy_cavalry':
    case 'knight':
      if (analysis.ageIndex >= 1) {
        if (analysis.militaryCount > 5) utility = 50;
        else utility = 30;
      }
      break;
      
    case 'catapult':
    case 'trebuchet':
    case 'cannon':
      if (analysis.militaryAdvantage > 1 && analysis.militaryCount > 8) utility = 60;
      else utility = 15;
      break;
      
    case 'light_tank':
    case 'main_battle_tank':
    case 'armored_car':
      if (analysis.ageIndex >= AGE_ORDER.indexOf('industrial')) {
        if (analysis.militaryAdvantage > 1) utility = 65;
        else utility = 45;
      }
      break;
      
    case 'fighter':
    case 'bomber':
      if (analysis.ageIndex >= AGE_ORDER.indexOf('modern')) {
        if (analysis.militaryAdvantage > 0.8) utility = 55;
        else utility = 35;
      }
      break;
  }
  
  return utility;
}

// ============================================================================
// ACTION GENERATORS
// ============================================================================

function generateBuildActions(
  state: RoNGameState,
  player: RoNPlayer,
  analysis: AIAnalysis,
  config: AIConfig
): AIAction[] {
  const actions: AIAction[] = [];
  
  // List of buildings to consider
  const buildingTypes: RoNBuildingType[] = [
    'farm', 'woodcutters_camp', 'lumber_mill', 'mine', 'smelter', 'market',
    'library', 'university', 'temple',
    'barracks', 'stable', 'siege_factory', 'dock',
    'tower', 'fort', 'fortress', 'castle',
    'oil_well', 'refinery', 'airbase', 'auto_plant', 'factory',
    'city_center',
  ];
  
  for (const buildingType of buildingTypes) {
    const utility = calculateBuildUtility(buildingType, analysis, player, config);
    if (utility > 10) {
      actions.push({
        type: 'build',
        priority: utility,
        description: `Build ${buildingType}`,
        execute: () => executeBuild(state, player, buildingType, analysis),
      });
    }
  }
  
  return actions;
}

function generateTrainActions(
  state: RoNGameState,
  player: RoNPlayer,
  analysis: AIAnalysis,
  config: AIConfig
): AIAction[] {
  const actions: AIAction[] = [];
  
  // Find available production buildings
  for (const prodBuilding of analysis.productionBuildings) {
    const producibleUnits = UNIT_PRODUCTION_BUILDINGS[prodBuilding.type] || [];
    
    // Skip if queue is full
    if (prodBuilding.building.queuedUnits.length >= 3) continue;
    
    for (const unitType of producibleUnits) {
      const utility = calculateTrainUtility(unitType as UnitType, analysis, player, config);
      if (utility > 10) {
        actions.push({
          type: 'train',
          priority: utility,
          description: `Train ${unitType} at ${prodBuilding.type}`,
          execute: () => executeTrain(state, player, unitType as UnitType, prodBuilding.pos),
        });
      }
    }
  }
  
  return actions;
}

function generateWorkerActions(
  state: RoNGameState,
  player: RoNPlayer,
  analysis: AIAnalysis,
  config: AIConfig
): AIAction[] {
  const actions: AIAction[] = [];
  
  if (analysis.idleCitizens.length === 0) return actions;
  
  // Priority: assign workers to buildings based on resource pressure
  const priorityOrder: { task: UnitTask; buildings: RoNBuildingType[]; resource: ResourceType }[] = [
    { task: 'gather_food', buildings: ['farm', 'granary'], resource: 'food' },
    { task: 'gather_wood', buildings: ['woodcutters_camp', 'lumber_mill'], resource: 'wood' },
    { task: 'gather_metal', buildings: ['mine', 'smelter'], resource: 'metal' },
    { task: 'gather_gold', buildings: ['market'], resource: 'gold' },
    { task: 'gather_oil', buildings: ['oil_well', 'refinery'], resource: 'oil' },
    { task: 'gather_knowledge', buildings: ['library', 'university'], resource: 'knowledge' },
  ];
  
  // Sort by resource pressure
  priorityOrder.sort((a, b) => {
    const pressureA = analysis.resourcePressure[a.resource];
    const pressureB = analysis.resourcePressure[b.resource];
    const pressureOrder = { critical: 0, low: 1, ok: 2, abundant: 3 };
    return pressureOrder[pressureA] - pressureOrder[pressureB];
  });
  
  for (const priority of priorityOrder) {
    for (const citizen of analysis.idleCitizens) {
      // Find nearest building of this type with capacity
      let bestBuilding: { x: number; y: number } | null = null;
      let bestDist = Infinity;
      
      for (let y = 0; y < state.gridSize; y++) {
        for (let x = 0; x < state.gridSize; x++) {
          const tile = state.grid[y][x];
          if (tile.ownerId === player.id && 
              tile.building && 
              tile.building.constructionProgress >= 100 &&
              priority.buildings.includes(tile.building.type as RoNBuildingType)) {
            
            // Check worker capacity
            const buildingStats = BUILDING_STATS[tile.building.type as RoNBuildingType];
            const maxWorkers = buildingStats?.maxWorkers ?? 5;
            const currentWorkers = countWorkersAtBuilding(state.units, x, y, player.id);
            
            if (currentWorkers < maxWorkers) {
              const dist = Math.sqrt((citizen.x - x) ** 2 + (citizen.y - y) ** 2);
              if (dist < bestDist) {
                bestDist = dist;
                bestBuilding = { x, y };
              }
            }
          }
        }
      }
      
      if (bestBuilding) {
        const utility = analysis.resourcePressure[priority.resource] === 'critical' ? 90 :
                       analysis.resourcePressure[priority.resource] === 'low' ? 70 : 50;
        
        actions.push({
          type: 'assign_worker',
          priority: utility,
          description: `Assign citizen to ${priority.task}`,
          execute: () => executeAssignWorker(state, citizen, priority.task, bestBuilding!),
        });
      }
    }
  }
  
  return actions;
}

function generateMilitaryActions(
  state: RoNGameState,
  player: RoNPlayer,
  analysis: AIAnalysis,
  config: AIConfig
): AIAction[] {
  const actions: AIAction[] = [];
  
  // Defense: respond to nearby threats
  if (analysis.threatenedBuildings.length > 0 && analysis.idleMilitary.length > 0) {
    const threat = analysis.threatenedBuildings[0];
    actions.push({
      type: 'defend',
      priority: 95,
      description: `Defend building at ${threat.x},${threat.y}`,
      execute: () => executeDefend(state, player, threat, analysis.idleMilitary),
    });
  }
  
  // Attack: if we have military advantage
  if (analysis.militaryAdvantage >= config.raidWhenAdvantage && 
      analysis.idleMilitary.length >= config.attackThreshold) {
    // Find target
    let target: { x: number; y: number } | null = null;
    let targetPriority = 0;
    
    for (let y = 0; y < state.gridSize; y++) {
      for (let x = 0; x < state.gridSize; x++) {
        const tile = state.grid[y][x];
        if (tile.ownerId && tile.ownerId !== player.id && tile.building) {
          // Prioritize city centers, then production, then economic
          let priority = 10;
          const bType = tile.building.type as RoNBuildingType;
          if (CITY_CENTER_TYPES.includes(bType)) priority = 100;
          else if (UNIT_PRODUCTION_BUILDINGS[bType]) priority = 70;
          else if (ECONOMIC_BUILDINGS.includes(bType)) priority = 50;
          
          // Closer targets get bonus
          for (const center of analysis.cityCenters) {
            const dist = Math.sqrt((x - center.x) ** 2 + (y - center.y) ** 2);
            priority += Math.max(0, 30 - dist);
          }
          
          if (priority > targetPriority) {
            targetPriority = priority;
            target = { x, y };
          }
        }
      }
    }
    
    if (target) {
      actions.push({
        type: 'attack',
        priority: 60 + analysis.militaryAdvantage * 10,
        description: `Attack enemy at ${target.x},${target.y}`,
        execute: () => executeAttack(state, player, target!, analysis.idleMilitary),
      });
    }
  }
  
  // Raid: send small force to harass enemy economy
  if (analysis.militaryAdvantage > 1.2 && analysis.idleMilitary.length >= 3) {
    // Find enemy economic building
    let raidTarget: { x: number; y: number } | null = null;
    
    for (let y = 0; y < state.gridSize; y++) {
      for (let x = 0; x < state.gridSize; x++) {
        const tile = state.grid[y][x];
        if (tile.ownerId && tile.ownerId !== player.id && tile.building) {
          const bType = tile.building.type as RoNBuildingType;
          if (ECONOMIC_BUILDINGS.includes(bType)) {
            raidTarget = { x, y };
            break;
          }
        }
      }
      if (raidTarget) break;
    }
    
    if (raidTarget) {
      actions.push({
        type: 'raid',
        priority: 40,
        description: `Raid enemy economy at ${raidTarget.x},${raidTarget.y}`,
        execute: () => executeRaid(state, player, raidTarget!, analysis.idleMilitary.slice(0, 3)),
      });
    }
  }
  
  return actions;
}

function generateStrategicActions(
  state: RoNGameState,
  player: RoNPlayer,
  analysis: AIAnalysis,
  config: AIConfig
): AIAction[] {
  const actions: AIAction[] = [];
  
  // Age advancement
  if (analysis.canAdvanceAge) {
    // Higher priority if we're behind or have surplus resources
    let priority = 85;
    if (analysis.resourcePressure.food === 'abundant' && 
        analysis.resourcePressure.wood === 'abundant') {
      priority = 95;
    }
    
    actions.push({
      type: 'advance_age',
      priority,
      description: `Advance to ${AGE_ORDER[analysis.ageIndex + 1]}`,
      execute: () => executeAdvanceAge(state, player),
    });
  }
  
  return actions;
}

// ============================================================================
// ACTION EXECUTORS
// ============================================================================

function executeBuild(
  state: RoNGameState,
  player: RoNPlayer,
  buildingType: RoNBuildingType,
  analysis: AIAnalysis
): RoNGameState {
  const stats = BUILDING_STATS[buildingType];
  if (!stats) return state;
  
  // Find placement location
  let bestPos: { x: number; y: number } | null = null;
  
  // Special handling for city center (use expansion spots)
  if (buildingType === 'city_center' && analysis.uncontestedExpansionSpots.length > 0) {
    bestPos = analysis.uncontestedExpansionSpots[Math.floor(Math.random() * analysis.uncontestedExpansionSpots.length)];
  } else {
    // Find location within territory
    const cityCenters = analysis.cityCenters;
    
    for (const center of cityCenters) {
      for (let radius = 3; radius < CITY_CENTER_RADIUS; radius++) {
        for (let angle = 0; angle < Math.PI * 2; angle += 0.3) {
          const x = Math.round(center.x + Math.cos(angle) * radius);
          const y = Math.round(center.y + Math.sin(angle) * radius);
          
          if (x < 0 || x >= state.gridSize || y < 0 || y >= state.gridSize) continue;
          
          // Check if location is valid
          let valid = true;
          for (let dy = 0; dy < stats.size.height; dy++) {
            for (let dx = 0; dx < stats.size.width; dx++) {
              const tile = state.grid[y + dy]?.[x + dx];
              if (!tile || tile.building || tile.terrain === 'water') {
                valid = false;
                break;
              }
              if (tile.forestDensity > 0 || tile.hasMetalDeposit || tile.hasOilDeposit) {
                valid = false;
                break;
              }
            }
            if (!valid) break;
          }
          
          // Special placement requirements
          if (valid && (buildingType === 'woodcutters_camp' || buildingType === 'lumber_mill')) {
            valid = isAdjacentToType(state.grid, state.gridSize, x, y, 'forest');
          }
          if (valid && buildingType === 'mine') {
            valid = isAdjacentToType(state.grid, state.gridSize, x, y, 'metal');
          }
          if (valid && (buildingType === 'oil_well' || buildingType === 'oil_platform')) {
            valid = isAdjacentToType(state.grid, state.gridSize, x, y, 'oil');
          }
          if (valid && buildingType === 'dock') {
            valid = isAdjacentToType(state.grid, state.gridSize, x, y, 'water');
          }
          
          if (valid) {
            bestPos = { x, y };
            break;
          }
        }
        if (bestPos) break;
      }
      if (bestPos) break;
    }
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
  const isInstant = buildingType === 'dock' || buildingType === 'farm';
  const newBuilding: RoNBuilding = {
    type: buildingType,
    level: 1,
    ownerId: player.id,
    health: stats.maxHealth,
    maxHealth: stats.maxHealth,
    constructionProgress: isInstant ? 100 : 0,
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

function executeTrain(
  state: RoNGameState,
  player: RoNPlayer,
  unitType: UnitType,
  buildingPos: { x: number; y: number }
): RoNGameState {
  const stats = UNIT_STATS[unitType];
  if (!stats) return state;
  
  // Deduct resources
  const newResources = { ...player.resources };
  for (const [resource, amount] of Object.entries(stats.cost)) {
    if (amount) {
      newResources[resource as ResourceType] -= amount;
    }
  }
  
  // Add to queue
  const newGrid = state.grid.map((row, gy) =>
    row.map((tile, gx) => {
      if (gx === buildingPos.x && gy === buildingPos.y && tile.building) {
        return {
          ...tile,
          building: {
            ...tile.building,
            queuedUnits: [...tile.building.queuedUnits, unitType],
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

function executeAssignWorker(
  state: RoNGameState,
  citizen: Unit,
  task: UnitTask,
  target: { x: number; y: number }
): RoNGameState {
  const newUnits = state.units.map(u => {
    if (u.id === citizen.id) {
      return {
        ...u,
        task,
        taskTarget: target,
        targetX: target.x + 0.5,
        targetY: target.y + 0.5,
        isMoving: true,
        idleSince: undefined,
      };
    }
    return u;
  });
  
  return { ...state, units: newUnits };
}

function executeDefend(
  state: RoNGameState,
  player: RoNPlayer,
  threat: { x: number; y: number; threats: Unit[] },
  military: Unit[]
): RoNGameState {
  const target = threat.threats[0];
  if (!target) return state;
  
  let unitIndex = 0;
  const numUnits = military.length;
  
  const newUnits = state.units.map(u => {
    if (military.some(m => m.id === u.id)) {
      // Spread formation around threat
      const angle = (unitIndex / numUnits) * Math.PI * 2;
      const radius = 1.5;
      const offsetX = Math.cos(angle) * radius;
      const offsetY = Math.sin(angle) * radius;
      unitIndex++;
      
      return {
        ...u,
        task: 'attack' as UnitTask,
        taskTarget: { x: target.x, y: target.y },
        targetX: target.x + offsetX,
        targetY: target.y + offsetY,
        isMoving: true,
        idleSince: undefined,
      };
    }
    return u;
  });
  
  return { ...state, units: newUnits };
}

function executeAttack(
  state: RoNGameState,
  player: RoNPlayer,
  target: { x: number; y: number },
  military: Unit[]
): RoNGameState {
  let unitIndex = 0;
  const numUnits = military.length;
  
  const newUnits = state.units.map(u => {
    if (military.some(m => m.id === u.id)) {
      // Spread formation
      let offsetX = 0;
      let offsetY = 0;
      
      if (numUnits > 1) {
        if (unitIndex === 0) {
          offsetX = 0;
          offsetY = 0;
        } else {
          const ring = Math.floor((unitIndex - 1) / 8) + 1;
          const posInRing = (unitIndex - 1) % 8;
          const angle = (posInRing / 8) * Math.PI * 2;
          offsetX = Math.cos(angle) * ring * 1.2;
          offsetY = Math.sin(angle) * ring * 1.2;
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
        idleSince: undefined,
      };
    }
    return u;
  });
  
  return { ...state, units: newUnits };
}

function executeRaid(
  state: RoNGameState,
  player: RoNPlayer,
  target: { x: number; y: number },
  raiders: Unit[]
): RoNGameState {
  let unitIndex = 0;
  
  const newUnits = state.units.map(u => {
    if (raiders.some(r => r.id === u.id)) {
      const angle = (unitIndex / raiders.length) * Math.PI * 2;
      const offsetX = Math.cos(angle) * 1.5;
      const offsetY = Math.sin(angle) * 1.5;
      unitIndex++;
      
      return {
        ...u,
        task: 'attack' as UnitTask,
        taskTarget: target,
        targetX: target.x + offsetX,
        targetY: target.y + offsetY,
        isMoving: true,
        idleSince: undefined,
      };
    }
    return u;
  });
  
  return { ...state, units: newUnits };
}

function executeAdvanceAge(state: RoNGameState, player: RoNPlayer): RoNGameState {
  const ageIndex = AGE_ORDER.indexOf(player.age);
  if (ageIndex >= AGE_ORDER.length - 1) return state;
  
  const nextAge = AGE_ORDER[ageIndex + 1];
  const requirements = AGE_REQUIREMENTS[nextAge];
  if (!requirements) return state;
  
  const newResources = { ...player.resources };
  for (const [resource, amount] of Object.entries(requirements)) {
    newResources[resource as ResourceType] -= amount;
  }
  
  const newPlayers = state.players.map(p =>
    p.id === player.id ? { ...p, age: nextAge as Age, resources: newResources } : p
  );
  
  return { ...state, players: newPlayers };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function countWorkersAtBuilding(units: Unit[], buildingX: number, buildingY: number, ownerId: string): number {
  return units.filter(u => {
    if (u.ownerId !== ownerId) return false;
    if (u.type !== 'citizen') return false;
    if (!u.task?.startsWith('gather_')) return false;
    const target = u.taskTarget as { x: number; y: number } | undefined;
    if (!target) return false;
    return target.x === buildingX && target.y === buildingY;
  }).length;
}

function isAdjacentToType(
  grid: RoNTile[][],
  gridSize: number,
  x: number,
  y: number,
  type: 'forest' | 'metal' | 'oil' | 'water'
): boolean {
  const directions = [
    { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
    { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
    { dx: -1, dy: -1 }, { dx: 1, dy: -1 },
    { dx: -1, dy: 1 }, { dx: 1, dy: 1 },
  ];
  
  for (const dir of directions) {
    const nx = x + dir.dx;
    const ny = y + dir.dy;
    if (nx < 0 || nx >= gridSize || ny < 0 || ny >= gridSize) continue;
    
    const tile = grid[ny][nx];
    switch (type) {
      case 'forest':
        if (tile.forestDensity > 0) return true;
        break;
      case 'metal':
        if (tile.hasMetalDeposit) return true;
        break;
      case 'oil':
        if (tile.hasOilDeposit) return true;
        break;
      case 'water':
        if (tile.terrain === 'water') return true;
        break;
    }
  }
  
  return false;
}

// ============================================================================
// MAIN AI ENTRY POINT
// ============================================================================

export function runAdvancedAI(state: RoNGameState): RoNGameState {
  let newState = state;
  
  for (const player of state.players) {
    if (player.type !== 'ai' || player.isDefeated) continue;
    
    const difficulty = player.difficulty || 'medium';
    const config = AI_CONFIGS[difficulty];
    
    // Analyze current game state
    const analysis = analyzeGameState(newState, player, config);
    
    // Generate all possible actions
    const allActions: AIAction[] = [
      ...generateStrategicActions(newState, player, analysis, config),
      ...generateBuildActions(newState, player, analysis, config),
      ...generateTrainActions(newState, player, analysis, config),
      ...generateWorkerActions(newState, player, analysis, config),
      ...generateMilitaryActions(newState, player, analysis, config),
    ];
    
    // Sort by priority (highest first)
    allActions.sort((a, b) => b.priority - a.priority);
    
    // Execute top actions based on difficulty
    const actionsPerTick = difficulty === 'easy' ? 2 : difficulty === 'medium' ? 4 : 6;
    let executedActions = 0;
    
    for (const action of allActions) {
      if (executedActions >= actionsPerTick) break;
      
      // Only execute if priority is high enough
      const minPriority = difficulty === 'easy' ? 30 : difficulty === 'medium' ? 20 : 10;
      if (action.priority < minPriority) continue;
      
      const result = action.execute();
      if (result !== newState) {
        newState = result;
        executedActions++;
      }
    }
  }
  
  return newState;
}

export { analyzeGameState };
export type { AIAnalysis, AIConfig };
