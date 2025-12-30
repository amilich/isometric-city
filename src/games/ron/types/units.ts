/**
 * Rise of Nations - Unit Types
 * 
 * Units are movable entities that can gather resources, build, or fight.
 */

import { Age } from './ages';
import { Resources } from './resources';

export type UnitCategory = 
  | 'civilian'    // Citizens, workers
  | 'infantry'    // Foot soldiers
  | 'ranged'      // Archers, riflemen
  | 'cavalry'     // Mounted units (horses, vehicles)
  | 'siege'       // Siege weapons
  | 'naval'       // Ships
  | 'air';        // Aircraft

export type UnitType =
  // Civilian
  | 'citizen'     // Basic worker, gathers resources, builds
  | 'merchant'    // Trade caravans
  | 'scholar'     // Research boost
  | 'spy'         // Espionage
  // Infantry - Ancient/Classical
  | 'militia'
  | 'hoplite'
  | 'legionary'
  // Infantry - Medieval
  | 'pikeman'
  | 'swordsman'
  | 'knight_foot'
  // Infantry - Enlightenment
  | 'musketeer'
  | 'fusilier'
  // Infantry - Industrial
  | 'rifleman'
  | 'machine_gunner'
  // Infantry - Modern
  | 'assault_infantry'
  | 'special_forces'
  // Ranged - Ancient/Classical
  | 'slinger'
  | 'archer'
  | 'crossbowman'
  // Ranged - Medieval
  | 'longbowman'
  // Ranged - Enlightenment/Industrial
  | 'skirmisher'
  // Cavalry - Ancient/Classical
  | 'scout_cavalry'
  | 'light_cavalry'
  | 'heavy_cavalry'
  // Cavalry - Medieval
  | 'knight'
  | 'cataphract'
  // Cavalry - Enlightenment
  | 'dragoon'
  | 'cuirassier'
  // Cavalry/Vehicles - Industrial
  | 'armored_car'
  | 'light_tank'
  // Cavalry/Vehicles - Modern
  | 'main_battle_tank'
  | 'apc'
  // Siege - Ancient/Classical
  | 'battering_ram'
  | 'catapult'
  // Siege - Medieval
  | 'trebuchet'
  | 'bombard'
  // Siege - Enlightenment
  | 'cannon'
  | 'mortar'
  // Siege - Industrial
  | 'howitzer'
  | 'field_gun'
  // Siege - Modern
  | 'artillery'
  | 'mlrs'
  // Naval - Ancient
  | 'fishing_boat'
  | 'galley'
  | 'trireme'
  // Naval - Medieval
  | 'carrack'
  | 'galleass'
  // Naval - Enlightenment
  | 'frigate'
  | 'ship_of_the_line'
  // Naval - Industrial
  | 'ironclad'
  | 'battleship'
  | 'cruiser'
  // Naval - Modern
  | 'destroyer'
  | 'aircraft_carrier'
  | 'submarine'
  // Air - Industrial (late)
  | 'biplane'
  | 'bomber_early'
  // Air - Modern
  | 'fighter'
  | 'bomber'
  | 'helicopter'
  | 'stealth_bomber';

export interface UnitStats {
  category: UnitCategory;
  cost: Partial<Resources>;
  health: number;
  attack: number;
  defense: number;
  speed: number;        // Movement speed (tiles per second)
  range: number;        // Attack range in tiles
  buildTime: number;    // Ticks to produce
  minAge: Age;
  visionRange: number;
  // Special abilities
  canBuild?: boolean;
  canGather?: boolean;
  canHeal?: boolean;
  antiAir?: boolean;    // Can attack air units
  isAir?: boolean;      // Is an air unit
  isNaval?: boolean;    // Is a naval unit
  carriesUnits?: number; // Can transport other units
}

export const UNIT_STATS: Record<UnitType, UnitStats> = {
  // Civilians
  citizen: {
    category: 'civilian',
    cost: { food: 80 },  // Increased from 50
    health: 30,
    attack: 2,
    defense: 0,
    speed: 1.5,
    range: 1,
    buildTime: 60,  // Increased from 20 (takes ~2 mins at 0.5 production speed)
    minAge: 'classical',
    visionRange: 4,
    canBuild: true,
    canGather: true,
  },
  merchant: {
    category: 'civilian',
    cost: { food: 30, gold: 50 },
    health: 50,
    attack: 0,
    defense: 0,
    speed: 2,
    range: 0,
    buildTime: 30,
    minAge: 'classical',
    visionRange: 5,
  },
  scholar: {
    category: 'civilian',
    cost: { food: 40, gold: 40, knowledge: 20 },
    health: 25,
    attack: 0,
    defense: 0,
    speed: 1.2,
    range: 0,
    buildTime: 40,
    minAge: 'medieval',
    visionRange: 4,
  },
  spy: {
    category: 'civilian',
    cost: { gold: 100 },
    health: 20,
    attack: 5,
    defense: 0,
    speed: 2.5,
    range: 1,
    buildTime: 50,
    minAge: 'enlightenment',
    visionRange: 8,
  },

  // Infantry - Ancient/Classical
  militia: {
    category: 'infantry',
    cost: { food: 40, wood: 20 },
    health: 50,
    attack: 8,
    defense: 2,
    speed: 1.2,
    range: 1,
    buildTime: 15,
    minAge: 'classical',
    visionRange: 4,
  },
  hoplite: {
    category: 'infantry',
    cost: { food: 60, metal: 30 },
    health: 80,
    attack: 12,
    defense: 6,
    speed: 1,
    range: 1,
    buildTime: 25,
    minAge: 'classical',
    visionRange: 4,
  },
  legionary: {
    category: 'infantry',
    cost: { food: 70, metal: 40, gold: 10 },
    health: 100,
    attack: 15,
    defense: 8,
    speed: 1.1,
    range: 1,
    buildTime: 30,
    minAge: 'classical',
    visionRange: 4,
  },
  pikeman: {
    category: 'infantry',
    cost: { food: 50, wood: 30, metal: 20 },
    health: 70,
    attack: 10,
    defense: 10,
    speed: 1,
    range: 2,
    buildTime: 25,
    minAge: 'medieval',
    visionRange: 4,
  },
  swordsman: {
    category: 'infantry',
    cost: { food: 60, metal: 50 },
    health: 90,
    attack: 18,
    defense: 5,
    speed: 1.2,
    range: 1,
    buildTime: 28,
    minAge: 'medieval',
    visionRange: 4,
  },
  knight_foot: {
    category: 'infantry',
    cost: { food: 80, metal: 70, gold: 20 },
    health: 120,
    attack: 20,
    defense: 12,
    speed: 1.1,
    range: 1,
    buildTime: 35,
    minAge: 'medieval',
    visionRange: 5,
  },
  musketeer: {
    category: 'infantry',
    cost: { food: 60, gold: 40 },
    health: 80,
    attack: 25,
    defense: 3,
    speed: 1.1,
    range: 4,
    buildTime: 30,
    minAge: 'enlightenment',
    visionRange: 5,
  },
  fusilier: {
    category: 'infantry',
    cost: { food: 70, gold: 50 },
    health: 90,
    attack: 30,
    defense: 4,
    speed: 1.1,
    range: 5,
    buildTime: 32,
    minAge: 'enlightenment',
    visionRange: 5,
  },
  rifleman: {
    category: 'infantry',
    cost: { food: 60, metal: 30, gold: 30 },
    health: 100,
    attack: 35,
    defense: 5,
    speed: 1.2,
    range: 6,
    buildTime: 28,
    minAge: 'industrial',
    visionRange: 6,
  },
  machine_gunner: {
    category: 'infantry',
    cost: { food: 80, metal: 60, gold: 40 },
    health: 90,
    attack: 50,
    defense: 4,
    speed: 0.9,
    range: 5,
    buildTime: 35,
    minAge: 'industrial',
    visionRange: 5,
  },
  assault_infantry: {
    category: 'infantry',
    cost: { food: 70, metal: 40, gold: 50, oil: 10 },
    health: 120,
    attack: 45,
    defense: 8,
    speed: 1.3,
    range: 5,
    buildTime: 30,
    minAge: 'modern',
    visionRange: 6,
  },
  special_forces: {
    category: 'infantry',
    cost: { food: 100, metal: 50, gold: 80, oil: 20 },
    health: 150,
    attack: 60,
    defense: 12,
    speed: 1.5,
    range: 6,
    buildTime: 45,
    minAge: 'modern',
    visionRange: 8,
  },

  // Ranged units
  slinger: {
    category: 'ranged',
    cost: { food: 30 },
    health: 30,
    attack: 6,
    defense: 0,
    speed: 1.3,
    range: 4,
    buildTime: 12,
    minAge: 'classical',
    visionRange: 5,
  },
  archer: {
    category: 'ranged',
    cost: { food: 40, wood: 30 },
    health: 40,
    attack: 10,
    defense: 1,
    speed: 1.2,
    range: 5,
    buildTime: 18,
    minAge: 'classical',
    visionRange: 6,
  },
  crossbowman: {
    category: 'ranged',
    cost: { food: 50, wood: 40, metal: 20 },
    health: 50,
    attack: 15,
    defense: 2,
    speed: 1,
    range: 6,
    buildTime: 22,
    minAge: 'classical',
    visionRange: 6,
  },
  longbowman: {
    category: 'ranged',
    cost: { food: 60, wood: 50 },
    health: 45,
    attack: 18,
    defense: 1,
    speed: 1.1,
    range: 8,
    buildTime: 25,
    minAge: 'medieval',
    visionRange: 7,
  },
  skirmisher: {
    category: 'ranged',
    cost: { food: 50, gold: 30 },
    health: 55,
    attack: 22,
    defense: 2,
    speed: 1.4,
    range: 6,
    buildTime: 20,
    minAge: 'enlightenment',
    visionRange: 6,
  },

  // Cavalry
  scout_cavalry: {
    category: 'cavalry',
    cost: { food: 50, gold: 30 },
    health: 60,
    attack: 6,
    defense: 2,
    speed: 3,
    range: 1,
    buildTime: 20,
    minAge: 'classical',
    visionRange: 8,
  },
  light_cavalry: {
    category: 'cavalry',
    cost: { food: 60, gold: 50 },
    health: 80,
    attack: 12,
    defense: 4,
    speed: 2.5,
    range: 1,
    buildTime: 25,
    minAge: 'classical',
    visionRange: 6,
  },
  heavy_cavalry: {
    category: 'cavalry',
    cost: { food: 80, metal: 60, gold: 60 },
    health: 120,
    attack: 20,
    defense: 10,
    speed: 2,
    range: 1,
    buildTime: 35,
    minAge: 'classical',
    visionRange: 5,
  },
  knight: {
    category: 'cavalry',
    cost: { food: 100, metal: 80, gold: 80 },
    health: 180,
    attack: 30,
    defense: 15,
    speed: 2.2,
    range: 1,
    buildTime: 45,
    minAge: 'medieval',
    visionRange: 5,
  },
  cataphract: {
    category: 'cavalry',
    cost: { food: 120, metal: 100, gold: 90 },
    health: 220,
    attack: 35,
    defense: 20,
    speed: 1.8,
    range: 1,
    buildTime: 50,
    minAge: 'medieval',
    visionRange: 5,
  },
  dragoon: {
    category: 'cavalry',
    cost: { food: 80, gold: 100 },
    health: 100,
    attack: 28,
    defense: 6,
    speed: 2.5,
    range: 4,
    buildTime: 35,
    minAge: 'enlightenment',
    visionRange: 6,
  },
  cuirassier: {
    category: 'cavalry',
    cost: { food: 100, metal: 80, gold: 80 },
    health: 150,
    attack: 35,
    defense: 12,
    speed: 2.2,
    range: 1,
    buildTime: 40,
    minAge: 'enlightenment',
    visionRange: 5,
  },
  armored_car: {
    category: 'cavalry',
    cost: { metal: 100, gold: 80, oil: 30 },
    health: 120,
    attack: 40,
    defense: 15,
    speed: 3.5,
    range: 4,
    buildTime: 35,
    minAge: 'industrial',
    visionRange: 7,
  },
  light_tank: {
    category: 'cavalry',
    cost: { metal: 200, gold: 150, oil: 60 },
    health: 250,
    attack: 60,
    defense: 25,
    speed: 2.5,
    range: 5,
    buildTime: 50,
    minAge: 'industrial',
    visionRange: 6,
  },
  main_battle_tank: {
    category: 'cavalry',
    cost: { metal: 400, gold: 300, oil: 120 },
    health: 500,
    attack: 100,
    defense: 50,
    speed: 2,
    range: 6,
    buildTime: 70,
    minAge: 'modern',
    visionRange: 7,
  },
  apc: {
    category: 'cavalry',
    cost: { metal: 150, gold: 100, oil: 40 },
    health: 200,
    attack: 25,
    defense: 20,
    speed: 3,
    range: 3,
    buildTime: 40,
    minAge: 'modern',
    visionRange: 6,
    carriesUnits: 6,
  },

  // Siege
  battering_ram: {
    category: 'siege',
    cost: { wood: 100 },
    health: 150,
    attack: 50,
    defense: 5,
    speed: 0.5,
    range: 1,
    buildTime: 40,
    minAge: 'classical',
    visionRange: 3,
  },
  catapult: {
    category: 'siege',
    cost: { wood: 150, metal: 50 },
    health: 80,
    attack: 60,
    defense: 2,
    speed: 0.4,
    range: 10,
    buildTime: 50,
    minAge: 'classical',
    visionRange: 8,
  },
  trebuchet: {
    category: 'siege',
    cost: { wood: 200, metal: 100, gold: 50 },
    health: 100,
    attack: 100,
    defense: 2,
    speed: 0.3,
    range: 14,
    buildTime: 70,
    minAge: 'medieval',
    visionRange: 10,
  },
  bombard: {
    category: 'siege',
    cost: { wood: 100, metal: 200, gold: 100 },
    health: 120,
    attack: 120,
    defense: 3,
    speed: 0.35,
    range: 12,
    buildTime: 80,
    minAge: 'medieval',
    visionRange: 10,
  },
  cannon: {
    category: 'siege',
    cost: { metal: 200, gold: 150 },
    health: 100,
    attack: 140,
    defense: 3,
    speed: 0.5,
    range: 10,
    buildTime: 60,
    minAge: 'enlightenment',
    visionRange: 9,
  },
  mortar: {
    category: 'siege',
    cost: { metal: 150, gold: 100 },
    health: 60,
    attack: 80,
    defense: 1,
    speed: 0.6,
    range: 12,
    buildTime: 45,
    minAge: 'enlightenment',
    visionRange: 8,
  },
  howitzer: {
    category: 'siege',
    cost: { metal: 300, gold: 200, oil: 50 },
    health: 150,
    attack: 180,
    defense: 5,
    speed: 0.7,
    range: 14,
    buildTime: 70,
    minAge: 'industrial',
    visionRange: 10,
  },
  field_gun: {
    category: 'siege',
    cost: { metal: 200, gold: 150, oil: 30 },
    health: 100,
    attack: 120,
    defense: 3,
    speed: 1,
    range: 10,
    buildTime: 50,
    minAge: 'industrial',
    visionRange: 9,
  },
  artillery: {
    category: 'siege',
    cost: { metal: 400, gold: 300, oil: 80 },
    health: 180,
    attack: 250,
    defense: 8,
    speed: 0.8,
    range: 16,
    buildTime: 80,
    minAge: 'modern',
    visionRange: 12,
  },
  mlrs: {
    category: 'siege',
    cost: { metal: 500, gold: 400, oil: 120 },
    health: 150,
    attack: 400,
    defense: 5,
    speed: 1,
    range: 20,
    buildTime: 100,
    minAge: 'modern',
    visionRange: 10,
  },

  // Naval
  fishing_boat: {
    category: 'naval',
    cost: { wood: 50 },
    health: 40,
    attack: 0,
    defense: 0,
    speed: 2,
    range: 0,
    buildTime: 20,
    minAge: 'classical',
    visionRange: 5,
    isNaval: true,
    canGather: true,
  },
  galley: {
    category: 'naval',
    cost: { wood: 100, gold: 30 },
    health: 100,
    attack: 15,
    defense: 5,
    speed: 2,
    range: 2,
    buildTime: 30,
    minAge: 'classical',
    visionRange: 6,
    isNaval: true,
    carriesUnits: 5,
  },
  trireme: {
    category: 'naval',
    cost: { wood: 150, metal: 50, gold: 50 },
    health: 150,
    attack: 25,
    defense: 10,
    speed: 2.2,
    range: 3,
    buildTime: 40,
    minAge: 'classical',
    visionRange: 7,
    isNaval: true,
    carriesUnits: 8,
  },
  carrack: {
    category: 'naval',
    cost: { wood: 250, metal: 80, gold: 100 },
    health: 250,
    attack: 40,
    defense: 15,
    speed: 1.8,
    range: 5,
    buildTime: 60,
    minAge: 'medieval',
    visionRange: 8,
    isNaval: true,
    carriesUnits: 15,
  },
  galleass: {
    category: 'naval',
    cost: { wood: 300, metal: 120, gold: 120 },
    health: 300,
    attack: 60,
    defense: 20,
    speed: 1.5,
    range: 6,
    buildTime: 70,
    minAge: 'medieval',
    visionRange: 8,
    isNaval: true,
    carriesUnits: 10,
  },
  frigate: {
    category: 'naval',
    cost: { wood: 300, metal: 150, gold: 150 },
    health: 350,
    attack: 80,
    defense: 20,
    speed: 2.5,
    range: 8,
    buildTime: 70,
    minAge: 'enlightenment',
    visionRange: 10,
    isNaval: true,
  },
  ship_of_the_line: {
    category: 'naval',
    cost: { wood: 500, metal: 250, gold: 300 },
    health: 600,
    attack: 150,
    defense: 40,
    speed: 1.5,
    range: 10,
    buildTime: 100,
    minAge: 'enlightenment',
    visionRange: 12,
    isNaval: true,
  },
  ironclad: {
    category: 'naval',
    cost: { metal: 400, gold: 300, oil: 50 },
    health: 800,
    attack: 200,
    defense: 60,
    speed: 1.8,
    range: 10,
    buildTime: 100,
    minAge: 'industrial',
    visionRange: 12,
    isNaval: true,
  },
  battleship: {
    category: 'naval',
    cost: { metal: 700, gold: 500, oil: 150 },
    health: 1500,
    attack: 350,
    defense: 100,
    speed: 1.5,
    range: 14,
    buildTime: 150,
    minAge: 'industrial',
    visionRange: 15,
    isNaval: true,
  },
  cruiser: {
    category: 'naval',
    cost: { metal: 500, gold: 400, oil: 100 },
    health: 800,
    attack: 200,
    defense: 50,
    speed: 2.5,
    range: 12,
    buildTime: 100,
    minAge: 'industrial',
    visionRange: 14,
    isNaval: true,
    antiAir: true,
  },
  destroyer: {
    category: 'naval',
    cost: { metal: 400, gold: 350, oil: 120 },
    health: 600,
    attack: 180,
    defense: 35,
    speed: 3,
    range: 10,
    buildTime: 80,
    minAge: 'modern',
    visionRange: 15,
    isNaval: true,
    antiAir: true,
  },
  aircraft_carrier: {
    category: 'naval',
    cost: { metal: 1000, gold: 800, oil: 300 },
    health: 2000,
    attack: 50,
    defense: 80,
    speed: 1.5,
    range: 6,
    buildTime: 200,
    minAge: 'modern',
    visionRange: 20,
    isNaval: true,
    carriesUnits: 12,
    antiAir: true,
  },
  submarine: {
    category: 'naval',
    cost: { metal: 500, gold: 400, oil: 150 },
    health: 400,
    attack: 300,
    defense: 20,
    speed: 2,
    range: 8,
    buildTime: 100,
    minAge: 'modern',
    visionRange: 8,
    isNaval: true,
  },

  // Air
  biplane: {
    category: 'air',
    cost: { metal: 150, gold: 100, oil: 40 },
    health: 80,
    attack: 30,
    defense: 5,
    speed: 5,
    range: 6,
    buildTime: 40,
    minAge: 'industrial',
    visionRange: 12,
    isAir: true,
  },
  bomber_early: {
    category: 'air',
    cost: { metal: 250, gold: 200, oil: 80 },
    health: 120,
    attack: 100,
    defense: 8,
    speed: 4,
    range: 10,
    buildTime: 60,
    minAge: 'industrial',
    visionRange: 10,
    isAir: true,
  },
  fighter: {
    category: 'air',
    cost: { metal: 300, gold: 250, oil: 100 },
    health: 150,
    attack: 80,
    defense: 20,
    speed: 7,
    range: 8,
    buildTime: 50,
    minAge: 'modern',
    visionRange: 15,
    isAir: true,
    antiAir: true,
  },
  bomber: {
    category: 'air',
    cost: { metal: 500, gold: 400, oil: 150 },
    health: 250,
    attack: 250,
    defense: 15,
    speed: 5,
    range: 12,
    buildTime: 80,
    minAge: 'modern',
    visionRange: 12,
    isAir: true,
  },
  helicopter: {
    category: 'air',
    cost: { metal: 200, gold: 200, oil: 80 },
    health: 180,
    attack: 60,
    defense: 15,
    speed: 4,
    range: 6,
    buildTime: 50,
    minAge: 'modern',
    visionRange: 10,
    isAir: true,
    carriesUnits: 4,
  },
  stealth_bomber: {
    category: 'air',
    cost: { metal: 800, gold: 700, oil: 250 },
    health: 300,
    attack: 400,
    defense: 30,
    speed: 6,
    range: 15,
    buildTime: 120,
    minAge: 'modern',
    visionRange: 15,
    isAir: true,
  },
};

// Unit instance (an actual unit in the game)
export interface Unit {
  id: string;
  type: UnitType;
  ownerId: string;
  x: number;           // World position X
  y: number;           // World position Y
  health: number;
  maxHealth: number;
  
  // State
  isSelected: boolean;
  isMoving: boolean;
  targetX?: number;
  targetY?: number;
  path?: { x: number; y: number }[];
  
  // Tasks
  task?: UnitTask;
  taskTarget?: { x: number; y: number } | string; // Position or building/unit ID
  idleSince?: number; // Tick when unit became idle (for auto-work assignment)
  
  // Combat
  attackCooldown: number;
  lastAttackTime: number;
  isAttacking: boolean; // True when unit is actively attacking (for animation)
  
  // Cargo (for transport units)
  carriedUnits?: string[];

  // Flee reaction (tick when enemy was first spotted)
  enemySpottedAt?: number;
}

export type UnitTask =
  | 'idle'
  | 'move'
  | 'gather_food'
  | 'gather_wood'
  | 'gather_metal'
  | 'gather_gold'
  | 'gather_oil'
  | 'gather_knowledge'
  | 'gather_fish'
  | 'build'
  | 'repair'
  | 'attack'
  | 'patrol'
  | 'garrison'
  | 'flee';
