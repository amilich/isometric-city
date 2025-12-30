/**
 * Rise of Nations - Building Types
 * 
 * Buildings provide resources, spawn units, and give strategic advantages.
 * Based on Rise of Nations building list.
 */

import { Age } from './ages';
import { Resources } from './resources';

export type RoNBuildingType =
  // Core buildings
  | 'empty' | 'grass' | 'water' | 'road'
  // City/Town buildings
  | 'city_center'    // Town hall - core building, spawns citizens
  | 'small_city'     // Upgraded city center
  | 'large_city'     // Further upgraded city center
  | 'major_city'     // Maximum city upgrade
  // Economic buildings
  | 'farm'           // Food production
  | 'woodcutters_camp' // Wood production
  | 'granary'        // Food storage
  | 'lumber_mill'    // Wood processing, increased yield
  | 'mine'           // Metal production
  | 'smelter'        // Metal processing
  | 'market'         // Gold generation, trade
  | 'oil_well'       // Oil extraction (industrial+)
  | 'oil_platform'   // Offshore oil (industrial+)
  | 'refinery'       // Oil processing (industrial+)
  // Knowledge buildings
  | 'library'        // Research, age advancement
  | 'university'     // Higher education, faster research
  | 'temple'         // Faith/culture bonuses
  | 'senate'         // Government bonuses
  // Military production
  | 'barracks'       // Infantry units
  | 'stable'         // Cavalry/vehicles
  | 'siege_factory'  // Siege weapons
  | 'dock'           // Naval units
  | 'auto_plant'     // Modern vehicles (industrial+)
  | 'factory'        // Industrial production
  | 'airbase'        // Aircraft (modern only)
  | 'missile_silo'   // Nuclear weapons (modern only)
  // Defensive buildings
  | 'tower'          // Basic defense
  | 'stockade'       // Wooden walls (early)
  | 'fort'           // Stone fort
  | 'fortress'       // Large fortress
  | 'castle'         // Medieval castle
  | 'bunker'         // Modern bunker
  | 'lookout'        // Vision range
  | 'observation_post' // Extended vision
  | 'redoubt'        // Defensive position
  // Anti-air (modern)
  | 'air_defense_gun'
  | 'radar_air_defense'
  | 'sam_installation'
  // Wonders (unique per game)
  | 'pyramids'
  | 'colosseum'
  | 'colossus'
  | 'hanging_gardens'
  | 'terra_cotta_army'
  | 'angkor_wat'
  | 'forbidden_city'
  | 'versailles'
  | 'kremlin'
  | 'taj_mahal'
  | 'porcelain_tower'
  | 'red_fort'
  | 'temple_of_tikal'
  | 'statue_of_liberty'
  | 'eiffel_tower'
  | 'supercollider'
  | 'space_program';

export interface RoNBuilding {
  type: RoNBuildingType;
  level: number;
  ownerId: string;        // Player ID who owns this building
  health: number;         // Current health
  maxHealth: number;      // Maximum health
  constructionProgress: number; // 0-100
  queuedUnits: string[];  // Unit types being produced
  productionProgress: number; // Progress on current unit
  garrisonedUnits: string[]; // Unit IDs inside
  lastAttackerId?: string; // Player ID who last attacked this building (for elimination rewards)
}

// Building costs and stats
export interface BuildingStats {
  cost: Partial<Resources>;
  maxHealth: number;
  buildTime: number;      // Ticks to construct
  minAge: Age;            // Earliest age available
  size: { width: number; height: number };
  providesHousing?: number;      // Population capacity increase
  providesStorage?: Partial<Resources>; // Storage capacity increase
  gatherBonus?: Partial<Resources>; // % bonus to nearby gathering
  garrisonSlots?: number; // How many units can garrison inside
  attackDamage?: number;  // If building can attack
  attackRange?: number;   // Attack range in tiles
  visionRange?: number;   // How far it can see
  maxWorkers?: number;    // Maximum workers that can gather at this building
}

// Sprite sheet position for each building type
// Based on the ages sprite sheets having the same layout as sprites_red_water_new
// The city center is at column 3 (0-indexed: 2), row 6 (0-indexed: 5)
export const BUILDING_SPRITE_POSITIONS: Partial<Record<RoNBuildingType, { row: number; col: number }>> = {
  city_center: { row: 5, col: 2 },  // 3rd column, 6th row
  // Map other buildings to appropriate sprite sheet positions
  farm: { row: 0, col: 0 },         // Use existing farm assets
  barracks: { row: 2, col: 0 },     // Placeholder - industrial building style
  library: { row: 1, col: 1 },      // Education-style building
  market: { row: 1, col: 2 },       // Commercial-style building
  tower: { row: 4, col: 0 },        // Tower/defensive
  mine: { row: 0, col: 3 },         // Industrial building
  lumber_mill: { row: 0, col: 4 },  // Industrial building
  // More mappings will be added as we identify sprite positions
};

export const BUILDING_STATS: Record<RoNBuildingType, BuildingStats> = {
  empty: { cost: {}, maxHealth: 0, buildTime: 0, minAge: 'classical', size: { width: 1, height: 1 } },
  grass: { cost: {}, maxHealth: 0, buildTime: 0, minAge: 'classical', size: { width: 1, height: 1 } },
  water: { cost: {}, maxHealth: 0, buildTime: 0, minAge: 'classical', size: { width: 1, height: 1 } },
  road: { cost: { wood: 10 }, maxHealth: 100, buildTime: 5, minAge: 'classical', size: { width: 1, height: 1 } },
  
  // City centers - 3x3 buildings like IsoCity city hall (DOUBLED HOUSING!)
  city_center: { 
    cost: { wood: 200, gold: 100 }, 
    maxHealth: 2000, 
    buildTime: 50,
    minAge: 'classical',
    size: { width: 3, height: 3 },
    providesHousing: 10,  // Reduced by 50%
    visionRange: 8,
  },
  small_city: {
    cost: { wood: 200, gold: 100, metal: 50 }, 
    maxHealth: 3000, 
    buildTime: 75, 
    minAge: 'classical', 
    size: { width: 3, height: 3 },
    providesHousing: 20,
    visionRange: 10,
  },
  large_city: { 
    cost: { wood: 600, gold: 400, metal: 200 }, 
    maxHealth: 4000, 
    buildTime: 100, 
    minAge: 'medieval', 
    size: { width: 3, height: 3 },
    providesHousing: 35,  // Reduced by 50%
    visionRange: 12,
  },
  major_city: { 
    cost: { wood: 1000, gold: 800, metal: 400 }, 
    maxHealth: 5000, 
    buildTime: 125, 
    minAge: 'enlightenment', 
    size: { width: 3, height: 3 },
    providesHousing: 50,  // Reduced by 50%
    visionRange: 15,
  },
  
  // Economic buildings
  farm: {
    cost: { wood: 50 },
    maxHealth: 500,
    buildTime: 20,
    minAge: 'classical',
    size: { width: 1, height: 1 },
    maxWorkers: 3,  // Reduced from 5 - more realistic
  },
  woodcutters_camp: { 
    cost: { wood: 30 }, 
    maxHealth: 300, 
    buildTime: 15, 
    minAge: 'classical', 
    size: { width: 1, height: 1 },
    maxWorkers: 3,  // Reduced from 5 - more realistic
  },
  granary: { 
    cost: { wood: 80 }, 
    maxHealth: 600, 
    buildTime: 25, 
    minAge: 'classical', 
    size: { width: 1, height: 1 },
    providesStorage: { food: 300 },
    maxWorkers: 3,  // Reduced from 5
  },
  lumber_mill: {
    cost: { wood: 100, gold: 30 },
    maxHealth: 700,
    buildTime: 30,
    minAge: 'classical',
    size: { width: 1, height: 1 },
    gatherBonus: { wood: 0.25 },
    maxWorkers: 3,  // Reduced from 5
  },
  mine: {
    cost: { wood: 80, gold: 50 },
    maxHealth: 800,
    buildTime: 35,
    minAge: 'classical',
    size: { width: 1, height: 1 },
    maxWorkers: 3,  // Reduced from 5
  },
  smelter: { 
    cost: { wood: 120, gold: 80, metal: 50 }, 
    maxHealth: 900, 
    buildTime: 40, 
    minAge: 'medieval', 
    size: { width: 2, height: 2 },
    gatherBonus: { metal: 0.3 },
    maxWorkers: 8,
  },
  market: {
    cost: { wood: 120 },  // No gold cost - market is how you GET gold
    maxHealth: 600,
    buildTime: 30,
    minAge: 'classical',
    size: { width: 2, height: 2 },
    maxWorkers: 3,  // Reduced from 5
  },
  oil_well: { 
    cost: { wood: 200, metal: 150, gold: 100 }, 
    maxHealth: 800, 
    buildTime: 50, 
    minAge: 'industrial', 
    size: { width: 1, height: 1 },
    maxWorkers: 4,
  },
  oil_platform: { 
    cost: { wood: 300, metal: 250, gold: 200 }, 
    maxHealth: 1000, 
    buildTime: 75, 
    minAge: 'industrial', 
    size: { width: 2, height: 2 },
    maxWorkers: 6,
  },
  refinery: {
    cost: { wood: 250, metal: 200, gold: 150 },
    maxHealth: 1200,
    buildTime: 60,
    minAge: 'industrial',
    size: { width: 2, height: 2 },
    gatherBonus: { oil: 0.5 },
    maxWorkers: 5,
  },
  
  // Knowledge buildings
  library: {
    cost: { wood: 100, gold: 80 },
    maxHealth: 700,
    buildTime: 40,
    minAge: 'classical',
    size: { width: 2, height: 2 },
    maxWorkers: 3,
  },
  university: {
    cost: { wood: 200, gold: 200, knowledge: 50 },
    maxWorkers: 5,
    maxHealth: 1000, 
    buildTime: 60, 
    minAge: 'medieval', 
    size: { width: 2, height: 2 },
  },
  temple: { 
    cost: { wood: 150, gold: 100 }, 
    maxHealth: 800, 
    buildTime: 45, 
    minAge: 'classical', 
    size: { width: 2, height: 2 },
  },
  senate: { 
    cost: { wood: 300, gold: 400, knowledge: 100 }, 
    maxHealth: 1500, 
    buildTime: 75, 
    minAge: 'enlightenment', 
    size: { width: 2, height: 2 },
  },
  
  // Military production
  barracks: { 
    cost: { wood: 100, gold: 50 }, 
    maxHealth: 1000, 
    buildTime: 30, 
    minAge: 'classical', 
    size: { width: 2, height: 2 },
    garrisonSlots: 5,
  },
  stable: { 
    cost: { wood: 150, gold: 100 }, 
    maxHealth: 1000, 
    buildTime: 40, 
    minAge: 'classical', 
    size: { width: 2, height: 2 },
    garrisonSlots: 3,
  },
  siege_factory: { 
    cost: { wood: 200, metal: 150, gold: 100 }, 
    maxHealth: 1200, 
    buildTime: 50, 
    minAge: 'medieval', 
    size: { width: 2, height: 2 },
  },
  dock: { 
    cost: { wood: 150, gold: 80 }, 
    maxHealth: 1000, 
    buildTime: 40, 
    minAge: 'classical', 
    size: { width: 2, height: 2 },
  },
  auto_plant: { 
    cost: { wood: 300, metal: 400, gold: 300, oil: 100 }, 
    maxHealth: 2000, 
    buildTime: 75, 
    minAge: 'industrial', 
    size: { width: 3, height: 3 },
  },
  factory: { 
    cost: { wood: 200, metal: 200, gold: 150 }, 
    maxHealth: 1500, 
    buildTime: 60, 
    minAge: 'industrial', 
    size: { width: 2, height: 2 },
  },
  airbase: { 
    cost: { wood: 400, metal: 500, gold: 400, oil: 200 }, 
    maxHealth: 2500, 
    buildTime: 100, 
    minAge: 'modern', 
    size: { width: 4, height: 4 },
    garrisonSlots: 8,
  },
  missile_silo: { 
    cost: { metal: 1000, gold: 1000, oil: 500, knowledge: 500 }, 
    maxHealth: 3000, 
    buildTime: 150, 
    minAge: 'modern', 
    size: { width: 2, height: 2 },
  },
  
  // Defensive buildings
  tower: { 
    cost: { wood: 50 }, 
    maxHealth: 500, 
    buildTime: 20, 
    minAge: 'classical', 
    size: { width: 1, height: 1 },
    attackDamage: 10,
    attackRange: 5,
    visionRange: 6,
  },
  stockade: { 
    cost: { wood: 100 }, 
    maxHealth: 800, 
    buildTime: 30, 
    minAge: 'classical', 
    size: { width: 1, height: 1 },
  },
  fort: { 
    cost: { wood: 150, metal: 100 }, 
    maxHealth: 1500, 
    buildTime: 50, 
    minAge: 'medieval',  // Not available in Classical era
    size: { width: 2, height: 2 },
    attackDamage: 20,
    attackRange: 6,
    garrisonSlots: 10,
    visionRange: 8,
  },
  fortress: { 
    cost: { wood: 250, metal: 200, gold: 100 }, 
    maxHealth: 2500, 
    buildTime: 75, 
    minAge: 'medieval', 
    size: { width: 3, height: 3 },
    attackDamage: 35,
    attackRange: 7,
    garrisonSlots: 15,
    visionRange: 10,
  },
  castle: { 
    cost: { wood: 400, metal: 300, gold: 200 }, 
    maxHealth: 4000, 
    buildTime: 100, 
    minAge: 'medieval', 
    size: { width: 3, height: 3 },
    attackDamage: 50,
    attackRange: 8,
    garrisonSlots: 20,
    visionRange: 12,
  },
  bunker: { 
    cost: { metal: 200, gold: 100 }, 
    maxHealth: 2000, 
    buildTime: 40, 
    minAge: 'modern', 
    size: { width: 1, height: 1 },
    attackDamage: 40,
    attackRange: 6,
    garrisonSlots: 8,
  },
  lookout: { 
    cost: { wood: 40 }, 
    maxHealth: 200, 
    buildTime: 10, 
    minAge: 'classical', 
    size: { width: 1, height: 1 },
    visionRange: 10,
  },
  observation_post: { 
    cost: { wood: 60, metal: 30 }, 
    maxHealth: 300, 
    buildTime: 15, 
    minAge: 'classical', 
    size: { width: 1, height: 1 },
    visionRange: 15,
  },
  redoubt: { 
    cost: { wood: 80, metal: 50 }, 
    maxHealth: 600, 
    buildTime: 25, 
    minAge: 'enlightenment', 
    size: { width: 1, height: 1 },
    attackDamage: 25,
    attackRange: 5,
    garrisonSlots: 5,
  },
  
  // Anti-air
  air_defense_gun: { 
    cost: { metal: 150, gold: 100 }, 
    maxHealth: 800, 
    buildTime: 30, 
    minAge: 'industrial', 
    size: { width: 1, height: 1 },
    attackDamage: 50,
    attackRange: 8,
  },
  radar_air_defense: { 
    cost: { metal: 250, gold: 200, oil: 50 }, 
    maxHealth: 1000, 
    buildTime: 40, 
    minAge: 'modern', 
    size: { width: 1, height: 1 },
    attackDamage: 80,
    attackRange: 12,
    visionRange: 20,
  },
  sam_installation: { 
    cost: { metal: 400, gold: 300, oil: 100 }, 
    maxHealth: 1200, 
    buildTime: 50, 
    minAge: 'modern', 
    size: { width: 2, height: 2 },
    attackDamage: 120,
    attackRange: 15,
  },
  
  // Wonders (expensive, unique effects)
  pyramids: { cost: { wood: 500, gold: 500 }, maxHealth: 5000, buildTime: 250, minAge: 'classical', size: { width: 3, height: 3 } },
  colosseum: { cost: { wood: 400, gold: 600, metal: 200 }, maxHealth: 4000, buildTime: 200, minAge: 'classical', size: { width: 3, height: 3 } },
  colossus: { cost: { metal: 800, gold: 600 }, maxHealth: 3000, buildTime: 225, minAge: 'classical', size: { width: 2, height: 2 } },
  hanging_gardens: { cost: { wood: 600, gold: 400 }, maxHealth: 3500, buildTime: 200, minAge: 'classical', size: { width: 3, height: 3 } },
  terra_cotta_army: { cost: { metal: 500, gold: 500 }, maxHealth: 2500, buildTime: 175, minAge: 'classical', size: { width: 3, height: 3 } },
  angkor_wat: { cost: { wood: 700, gold: 700 }, maxHealth: 4500, buildTime: 250, minAge: 'medieval', size: { width: 4, height: 4 } },
  forbidden_city: { cost: { wood: 800, gold: 1000, metal: 300 }, maxHealth: 5000, buildTime: 275, minAge: 'medieval', size: { width: 4, height: 4 } },
  versailles: { cost: { wood: 1000, gold: 1500 }, maxHealth: 4000, buildTime: 250, minAge: 'enlightenment', size: { width: 4, height: 4 } },
  kremlin: { cost: { wood: 800, metal: 600, gold: 1000 }, maxHealth: 6000, buildTime: 275, minAge: 'enlightenment', size: { width: 3, height: 3 } },
  taj_mahal: { cost: { wood: 600, metal: 400, gold: 1200 }, maxHealth: 4000, buildTime: 225, minAge: 'enlightenment', size: { width: 3, height: 3 } },
  porcelain_tower: { cost: { wood: 500, gold: 800, knowledge: 200 }, maxHealth: 3000, buildTime: 200, minAge: 'enlightenment', size: { width: 2, height: 2 } },
  red_fort: { cost: { wood: 700, metal: 500, gold: 800 }, maxHealth: 5500, buildTime: 250, minAge: 'enlightenment', size: { width: 3, height: 3 } },
  temple_of_tikal: { cost: { wood: 600, gold: 600 }, maxHealth: 3500, buildTime: 200, minAge: 'classical', size: { width: 3, height: 3 } },
  statue_of_liberty: { cost: { metal: 1000, gold: 1500 }, maxHealth: 4000, buildTime: 250, minAge: 'industrial', size: { width: 2, height: 2 } },
  eiffel_tower: { cost: { metal: 1500, gold: 1000 }, maxHealth: 3500, buildTime: 225, minAge: 'industrial', size: { width: 2, height: 2 } },
  supercollider: { cost: { metal: 2000, gold: 2000, knowledge: 1000, oil: 500 }, maxHealth: 5000, buildTime: 300, minAge: 'modern', size: { width: 4, height: 4 } },
  space_program: { cost: { metal: 2500, gold: 3000, knowledge: 1500, oil: 1000 }, maxHealth: 6000, buildTime: 350, minAge: 'modern', size: { width: 4, height: 4 } },
};

// Buildings that can produce units and what they can produce
// SIMPLIFIED: Each military building produces ONE unit type that scales with age
export const UNIT_PRODUCTION_BUILDINGS: Partial<Record<RoNBuildingType, string[]>> = {
  city_center: ['citizen'],
  small_city: ['citizen'],
  large_city: ['citizen'],
  major_city: ['citizen'],
  barracks: ['infantry', 'ranged'], // Infantry & Ranged both from barracks
  stable: ['cavalry'],              // Cavalry scales: light cavalry -> knight -> dragoon -> armored car -> tank
  siege_factory: ['siege'],         // Siege scales: catapult -> trebuchet -> cannon -> howitzer -> artillery
  dock: ['fishing_boat', 'naval'],  // Naval scales: galley -> carrack -> frigate -> ironclad -> destroyer
  auto_plant: ['cavalry'],          // Modern cavalry (tanks)
  factory: ['infantry'],            // Alternative infantry production
  airbase: ['air'],                 // Air scales: biplane -> fighter
};

// Economic buildings that need workers
export const ECONOMIC_BUILDINGS: RoNBuildingType[] = [
  'farm', 'granary',  // Food production
  'woodcutters_camp', 'lumber_mill',  // Wood production
  'mine', 'smelter',  // Metal production
  'market',  // Gold production
  'oil_well', 'oil_platform', 'refinery',  // Oil production
  'library', 'university'  // Knowledge production
];
