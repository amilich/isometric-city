// Competitive RTS game types - Age of Empires/Rise of Nations style

import { GameState, Tile, BuildingType } from './game';

// Player types
export type PlayerId = 'player' | 'ai1' | 'ai2' | 'ai3';

export interface Player {
  id: PlayerId;
  name: string;
  color: string;
  colorSecondary: string;
  money: number;
  score: number;
  isHuman: boolean;
  isEliminated: boolean;
  cityX: number; // Center of their city/starting position
  cityY: number;
  // Resource production rates
  incomePerTick: number;
  // Military stats
  unitCount: number;
  buildingsDestroyed: number;
  unitsLost: number;
  unitsKilled: number;
}

// Military unit types
export type MilitaryUnitType = 'infantry' | 'tank' | 'military_helicopter';
export type MilitaryUnitState = 'idle' | 'moving' | 'attacking' | 'dead';

export interface MilitaryUnit {
  id: number;
  type: MilitaryUnitType;
  owner: PlayerId;
  // Position (screen space for smooth movement)
  x: number;
  y: number;
  // Tile position (for gameplay logic)
  tileX: number;
  tileY: number;
  // Movement
  targetX: number | null;
  targetY: number | null;
  path: { x: number; y: number }[] | null;
  pathIndex: number;
  progress: number; // 0-1 progress along current path segment
  speed: number;
  direction: 'north' | 'east' | 'south' | 'west';
  // Combat
  state: MilitaryUnitState;
  health: number;
  maxHealth: number;
  attackPower: number;
  attackRange: number;
  attackCooldown: number;
  attackCooldownMax: number;
  attackTarget: { type: 'unit' | 'building'; id: number; tileX?: number; tileY?: number } | null;
  // Selection
  selected: boolean;
  // Visual
  animTimer: number;
  flashTimer: number;
}

// Unit stats by type
export const MILITARY_UNIT_STATS: Record<MilitaryUnitType, {
  name: string;
  cost: number;
  health: number;
  attackPower: number;
  attackRange: number;
  speed: number;
  attackCooldown: number;
  buildTime: number;
}> = {
  infantry: {
    name: 'Infantry',
    cost: 100,
    health: 100,
    attackPower: 15,
    attackRange: 1.5,
    speed: 0.15,
    attackCooldown: 1.0,
    buildTime: 3,
  },
  tank: {
    name: 'Tank',
    cost: 500,
    health: 400,
    attackPower: 50,
    attackRange: 3,
    speed: 0.25,
    attackCooldown: 2.0,
    buildTime: 8,
  },
  military_helicopter: {
    name: 'Attack Helicopter',
    cost: 800,
    health: 200,
    attackPower: 40,
    attackRange: 4,
    speed: 0.4,
    attackCooldown: 1.5,
    buildTime: 10,
  },
};

// Fog of war state
export type FogState = 'unexplored' | 'explored' | 'visible';

export interface FogOfWar {
  // 2D array matching grid size - visibility state for each tile
  tiles: FogState[][];
  // Last time each tile was visible (for gradual fog return)
  lastSeen: number[][];
}

// Building ownership tracking
export interface BuildingOwnership {
  tileX: number;
  tileY: number;
  owner: PlayerId;
  health: number;
  maxHealth: number;
}

// Competitive game state extends the base game state
export interface CompetitiveGameState {
  // Base game grid and settings
  grid: Tile[][];
  gridSize: number;
  tick: number;
  speed: 0 | 1 | 2 | 3;
  
  // Competitive-specific state
  gameMode: 'competitive';
  players: Player[];
  currentPlayer: PlayerId; // Always 'player' for human
  
  // Military units
  militaryUnits: MilitaryUnit[];
  nextUnitId: number;
  
  // Unit production queue per player
  productionQueues: Record<PlayerId, {
    type: MilitaryUnitType;
    progress: number;
    buildTime: number;
  }[]>;
  
  // Building ownership
  buildingOwnership: BuildingOwnership[];
  
  // Fog of war per player
  fogOfWar: Record<PlayerId, FogOfWar>;
  
  // Game state
  gameStarted: boolean;
  gameOver: boolean;
  winner: PlayerId | null;
  gameDuration: number; // seconds
  
  // Selection state
  selectedUnits: number[]; // unit IDs
  selectionBox: { startX: number; startY: number; endX: number; endY: number } | null;
  
  // UI state
  activePanel: 'none' | 'military' | 'scoreboard' | 'settings';
}

// Building health by type
export const BUILDING_HEALTH: Partial<Record<BuildingType, number>> = {
  // Residential
  house_small: 100,
  house_medium: 150,
  mansion: 200,
  apartment_low: 300,
  apartment_high: 500,
  // Commercial
  shop_small: 100,
  shop_medium: 150,
  office_low: 300,
  office_high: 500,
  mall: 600,
  // Industrial
  factory_small: 200,
  factory_medium: 350,
  factory_large: 500,
  warehouse: 250,
  // Services
  police_station: 300,
  fire_station: 300,
  hospital: 500,
  school: 300,
  university: 500,
  // Utilities
  power_plant: 600,
  water_tower: 200,
  // Special
  stadium: 800,
  museum: 500,
  airport: 1000,
  city_hall: 700,
  // Default for anything else
};

export const DEFAULT_BUILDING_HEALTH = 200;

// Player colors
export const PLAYER_COLORS: { primary: string; secondary: string; name: string }[] = [
  { primary: '#3b82f6', secondary: '#1d4ed8', name: 'Blue' },     // Player - Blue
  { primary: '#ef4444', secondary: '#b91c1c', name: 'Red' },      // AI 1 - Red
  { primary: '#22c55e', secondary: '#15803d', name: 'Green' },    // AI 2 - Green
  { primary: '#eab308', secondary: '#a16207', name: 'Yellow' },   // AI 3 - Yellow
];

// Starting resources for competitive mode (fewer than sandbox)
export const COMPETITIVE_STARTING_MONEY = 5000;

// Map size for competitive mode (larger)
export const COMPETITIVE_MAP_SIZE = 100;

// Vision range for different unit types
export const VISION_RANGE: Record<MilitaryUnitType, number> = {
  infantry: 4,
  tank: 5,
  military_helicopter: 8,
};

// Building vision range (for owned buildings)
export const BUILDING_VISION_RANGE = 5;

// Score calculation weights
export const SCORE_WEIGHTS = {
  money: 1,
  population: 10,
  buildings: 50,
  unitsKilled: 100,
  buildingsDestroyed: 200,
};
