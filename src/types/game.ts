// Game type definitions for IsoCity

export type BuildingType =
  | 'empty'
  | 'grass'
  | 'water'
  | 'road'
  | 'tree'
  // Residential
  | 'house_small'
  | 'house_medium'
  | 'mansion'
  | 'apartment_low'
  | 'apartment_high'
  // Commercial
  | 'shop_small'
  | 'shop_medium'
  | 'office_low'
  | 'office_high'
  | 'mall'
  // Industrial
  | 'factory_small'
  | 'factory_medium'
  | 'factory_large'
  | 'warehouse'
  // Services
  | 'police_station'
  | 'fire_station'
  | 'hospital'
  | 'school'
  | 'university'
  | 'park'
  | 'park_large'
  | 'tennis'
  // Utilities
  | 'power_plant'
  | 'water_tower'
  // Special
  | 'stadium'
  | 'museum'
  | 'airport'
  | 'space_program';

export type ZoneType = 'none' | 'residential' | 'commercial' | 'industrial';

export type Tool =
  | 'select'
  | 'bulldoze'
  | 'road'
  | 'tree'
  | 'zone_residential'
  | 'zone_commercial'
  | 'zone_industrial'
  | 'zone_dezone'
  | 'police_station'
  | 'fire_station'
  | 'hospital'
  | 'school'
  | 'university'
  | 'park'
  | 'park_large'
  | 'tennis'
  | 'power_plant'
  | 'water_tower'
  | 'stadium'
  | 'museum'
  | 'airport'
  | 'space_program';

export interface ToolInfo {
  name: string;
  cost: number;
  description: string;
  size?: number;
}

export const TOOL_INFO: Record<Tool, ToolInfo> = {
  select: { name: 'Select', cost: 0, description: 'Click to view tile info' },
  bulldoze: { name: 'Bulldoze', cost: 10, description: 'Remove buildings and zones' },
  road: { name: 'Road', cost: 25, description: 'Connect your city' },
  tree: { name: 'Tree', cost: 15, description: 'Plant trees to improve environment' },
  zone_residential: { name: 'Residential', cost: 50, description: 'Zone for housing' },
  zone_commercial: { name: 'Commercial', cost: 50, description: 'Zone for shops and offices' },
  zone_industrial: { name: 'Industrial', cost: 50, description: 'Zone for factories' },
  zone_dezone: { name: 'De-zone', cost: 0, description: 'Remove zoning' },
  police_station: { name: 'Police', cost: 500, description: 'Increase safety', size: 1 },
  fire_station: { name: 'Fire Station', cost: 500, description: 'Fight fires', size: 1 },
  hospital: { name: 'Hospital', cost: 1000, description: 'Improve health (2x2)', size: 2 },
  school: { name: 'School', cost: 400, description: 'Basic education (2x2)', size: 2 },
  university: { name: 'University', cost: 2000, description: 'Higher education (3x3)', size: 3 },
  park: { name: 'Small Park', cost: 150, description: 'Boost happiness and land value (1x1)', size: 1 },
  park_large: { name: 'Large Park', cost: 600, description: 'Large park (3x3)', size: 3 },
  tennis: { name: 'Tennis Court', cost: 200, description: 'Recreation facility', size: 1 },
  power_plant: { name: 'Power Plant', cost: 3000, description: 'Generate electricity (2x2)', size: 2 },
  water_tower: { name: 'Water Tower', cost: 1000, description: 'Provide water', size: 1 },
  stadium: { name: 'Stadium', cost: 5000, description: 'Major entertainment (3x3)', size: 3 },
  museum: { name: 'Museum', cost: 4000, description: 'Cultural attraction (3x3)', size: 3 },
  airport: { name: 'Airport', cost: 10000, description: 'Connect to the world (4x4)', size: 4 },
  space_program: { name: 'Space Program', cost: 15000, description: 'Reach for the stars (3x3)', size: 3 },
};

export interface Building {
  type: BuildingType;
  level: number;
  population: number;
  jobs: number;
  powered: boolean;
  watered: boolean;
  onFire: boolean;
  fireProgress: number;
  age: number;
}

export interface Tile {
  x: number;
  y: number;
  zone: ZoneType;
  building: Building;
  landValue: number;
  pollution: number;
  crime: number;
  traffic: number;
}

export interface Stats {
  population: number;
  jobs: number;
  money: number;
  income: number;
  expenses: number;
  happiness: number;
  health: number;
  education: number;
  safety: number;
  environment: number;
  demand: {
    residential: number;
    commercial: number;
    industrial: number;
  };
}

export interface BudgetCategory {
  name: string;
  funding: number;
  cost: number;
}

export interface Budget {
  police: BudgetCategory;
  fire: BudgetCategory;
  health: BudgetCategory;
  education: BudgetCategory;
  transportation: BudgetCategory;
  parks: BudgetCategory;
  power: BudgetCategory;
  water: BudgetCategory;
}

export interface ServiceCoverage {
  police: number[][];
  fire: number[][];
  health: number[][];
  education: number[][];
  power: boolean[][];
  water: boolean[][];
}

export interface Notification {
  id: string;
  title: string;
  description: string;
  icon: string;
  timestamp: number;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  requirement: string;
  unlocked: boolean;
  progress?: number;
  target?: number;
}

export interface AdvisorMessage {
  name: string;
  icon: string;
  messages: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface HistoryPoint {
  year: number;
  month: number;
  population: number;
  money: number;
  happiness: number;
}

export interface AdjacentCity {
  id: string;
  name: string;
  direction: 'north' | 'south' | 'east' | 'west';
  connected: boolean;
}

export interface WaterBody {
  id: string;
  name: string;
  tiles: { x: number; y: number }[];
  type: 'lake' | 'ocean';
}

export interface GameState {
  grid: Tile[][];
  gridSize: number;
  cityName: string;
  year: number;
  month: number;
  day: number;
  tick: number;
  speed: 0 | 1 | 2 | 3;
  selectedTool: Tool;
  taxRate: number;
  stats: Stats;
  budget: Budget;
  services: ServiceCoverage;
  notifications: Notification[];
  achievements: Achievement[];
  advisorMessages: AdvisorMessage[];
  history: HistoryPoint[];
  activePanel: 'none' | 'budget' | 'statistics' | 'advisors' | 'achievements' | 'settings';
  disastersEnabled: boolean;
  adjacentCities: AdjacentCity[];
  waterBodies: WaterBody[];
}

// Building evolution paths based on zone and level
export const RESIDENTIAL_BUILDINGS: BuildingType[] = ['house_small', 'house_medium', 'mansion', 'apartment_low', 'apartment_high'];
export const COMMERCIAL_BUILDINGS: BuildingType[] = ['shop_small', 'shop_medium', 'office_low', 'office_high', 'mall'];
export const INDUSTRIAL_BUILDINGS: BuildingType[] = ['factory_small', 'factory_medium', 'warehouse', 'factory_large', 'factory_large'];

export const BUILDING_STATS: Record<BuildingType, { maxPop: number; maxJobs: number; pollution: number; landValue: number }> = {
  empty: { maxPop: 0, maxJobs: 0, pollution: 0, landValue: 0 },
  grass: { maxPop: 0, maxJobs: 0, pollution: 0, landValue: 0 },
  water: { maxPop: 0, maxJobs: 0, pollution: 0, landValue: 5 },
  road: { maxPop: 0, maxJobs: 0, pollution: 2, landValue: 0 },
  tree: { maxPop: 0, maxJobs: 0, pollution: -5, landValue: 2 },
  house_small: { maxPop: 6, maxJobs: 0, pollution: 0, landValue: 10 },
  house_medium: { maxPop: 14, maxJobs: 0, pollution: 0, landValue: 22 },
  mansion: { maxPop: 18, maxJobs: 0, pollution: 0, landValue: 60 },
  apartment_low: { maxPop: 120, maxJobs: 0, pollution: 2, landValue: 40 },
  apartment_high: { maxPop: 260, maxJobs: 0, pollution: 3, landValue: 55 },
  shop_small: { maxPop: 0, maxJobs: 10, pollution: 1, landValue: 16 },
  shop_medium: { maxPop: 0, maxJobs: 28, pollution: 2, landValue: 26 },
  office_low: { maxPop: 0, maxJobs: 90, pollution: 2, landValue: 40 },
  office_high: { maxPop: 0, maxJobs: 210, pollution: 3, landValue: 55 },
  mall: { maxPop: 0, maxJobs: 260, pollution: 6, landValue: 70 },
  factory_small: { maxPop: 0, maxJobs: 40, pollution: 15, landValue: -5 },
  factory_medium: { maxPop: 0, maxJobs: 90, pollution: 28, landValue: -10 },
  factory_large: { maxPop: 0, maxJobs: 180, pollution: 55, landValue: -18 },
  warehouse: { maxPop: 0, maxJobs: 60, pollution: 18, landValue: -6 },
  police_station: { maxPop: 0, maxJobs: 20, pollution: 0, landValue: 15 },
  fire_station: { maxPop: 0, maxJobs: 20, pollution: 0, landValue: 10 },
  hospital: { maxPop: 0, maxJobs: 80, pollution: 0, landValue: 25 },
  school: { maxPop: 0, maxJobs: 25, pollution: 0, landValue: 15 },
  university: { maxPop: 0, maxJobs: 100, pollution: 0, landValue: 35 },
  park: { maxPop: 0, maxJobs: 2, pollution: -10, landValue: 20 },
  park_large: { maxPop: 0, maxJobs: 6, pollution: -25, landValue: 50 },
  tennis: { maxPop: 0, maxJobs: 1, pollution: -5, landValue: 15 },
  power_plant: { maxPop: 0, maxJobs: 30, pollution: 30, landValue: -20 },
  water_tower: { maxPop: 0, maxJobs: 5, pollution: 0, landValue: 5 },
  stadium: { maxPop: 0, maxJobs: 50, pollution: 5, landValue: 40 },
  museum: { maxPop: 0, maxJobs: 40, pollution: 0, landValue: 45 },
  airport: { maxPop: 0, maxJobs: 200, pollution: 20, landValue: 50 },
  space_program: { maxPop: 0, maxJobs: 150, pollution: 5, landValue: 80 },
};
