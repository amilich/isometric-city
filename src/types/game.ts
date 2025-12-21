// Game type definitions for IsoCity

export type BuildingType =
  | 'empty'
  | 'grass'
  | 'water'
  | 'road'
  | 'rail'
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
  // Transportation
  | 'subway_station'
  | 'rail_station'
  // Special
  | 'stadium'
  | 'museum'
  | 'airport'
  | 'space_program'
  | 'city_hall'
  | 'amusement_park'
  // Parks (new sprite sheet)
  | 'basketball_courts'
  | 'playground_small'
  | 'playground_large'
  | 'baseball_field_small'
  | 'soccer_field_small'
  | 'football_field'
  | 'baseball_stadium'
  | 'community_center'
  | 'office_building_small'
  | 'swimming_pool'
  | 'skate_park'
  | 'mini_golf_course'
  | 'bleachers_field'
  | 'go_kart_track'
  | 'amphitheater'
  | 'greenhouse_garden'
  | 'animal_pens_farm'
  | 'cabin_house'
  | 'campground'
  | 'marina_docks_small'
  | 'pier_large'
  | 'roller_coaster_small'
  | 'community_garden'
  | 'pond_park'
  | 'park_gate'
  | 'mountain_lodge'
  | 'mountain_trailhead';

export type ZoneType = 'none' | 'residential' | 'commercial' | 'industrial';

export type Tool =
  | 'select'
  | 'bulldoze'
  | 'road'
  | 'rail'
  | 'subway'
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
  | 'subway_station'
  | 'rail_station'
  | 'stadium'
  | 'museum'
  | 'airport'
  | 'space_program'
  | 'city_hall'
  | 'amusement_park'
  // Park tools (new sprite sheet)
  | 'basketball_courts'
  | 'playground_small'
  | 'playground_large'
  | 'baseball_field_small'
  | 'soccer_field_small'
  | 'football_field'
  | 'baseball_stadium'
  | 'community_center'
  | 'office_building_small'
  | 'swimming_pool'
  | 'skate_park'
  | 'mini_golf_course'
  | 'bleachers_field'
  | 'go_kart_track'
  | 'amphitheater'
  | 'greenhouse_garden'
  | 'animal_pens_farm'
  | 'cabin_house'
  | 'campground'
  | 'marina_docks_small'
  | 'pier_large'
  | 'roller_coaster_small'
  | 'community_garden'
  | 'pond_park'
  | 'park_gate'
  | 'mountain_lodge'
  | 'mountain_trailhead';

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
  rail: { name: 'Rail', cost: 40, description: 'Build railway tracks' },
  subway: { name: 'Subway', cost: 50, description: 'Underground transit' },
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
  subway_station: { name: 'Subway Station', cost: 750, description: 'Access to subway network', size: 1 },
  rail_station: { name: 'Rail Station', cost: 1000, description: 'Passenger rail station', size: 2 },
  stadium: { name: 'Stadium', cost: 5000, description: 'Boosts commercial demand (3x3)', size: 3 },
  museum: { name: 'Museum', cost: 4000, description: 'Boosts commercial & residential demand (3x3)', size: 3 },
  airport: { name: 'Airport', cost: 10000, description: 'Boosts commercial & industrial demand (4x4)', size: 4 },
  space_program: { name: 'Space Program', cost: 15000, description: 'Boosts industrial & residential demand (3x3)', size: 3 },
  city_hall: { name: 'City Hall', cost: 6000, description: 'Boosts all demand types (2x2)', size: 2 },
  amusement_park: { name: 'Amusement Park', cost: 12000, description: 'Major boost to commercial demand (4x4)', size: 4 },
  // Parks (new sprite sheet)
  basketball_courts: { name: 'Basketball Courts', cost: 250, description: 'Outdoor basketball facility', size: 1 },
  playground_small: { name: 'Small Playground', cost: 200, description: 'Children\'s playground', size: 1 },
  playground_large: { name: 'Large Playground', cost: 350, description: 'Large playground with more equipment (2x2)', size: 2 },
  baseball_field_small: { name: 'Baseball Field', cost: 800, description: 'Local baseball diamond (2x2)', size: 2 },
  soccer_field_small: { name: 'Soccer Field', cost: 400, description: 'Soccer/football pitch', size: 1 },
  football_field: { name: 'Football Field', cost: 1200, description: 'Football stadium (2x2)', size: 2 },
  baseball_stadium: { name: 'Baseball Stadium', cost: 6000, description: 'Professional baseball venue (3x3)', size: 3 },
  community_center: { name: 'Community Center', cost: 500, description: 'Local community hub', size: 1 },
  office_building_small: { name: 'Small Office', cost: 600, description: 'Small office building', size: 1 },
  swimming_pool: { name: 'Swimming Pool', cost: 450, description: 'Public swimming facility', size: 1 },
  skate_park: { name: 'Skate Park', cost: 300, description: 'Skateboarding park', size: 1 },
  mini_golf_course: { name: 'Mini Golf', cost: 700, description: 'Miniature golf course (2x2)', size: 2 },
  bleachers_field: { name: 'Bleachers Field', cost: 350, description: 'Sports field with seating', size: 1 },
  go_kart_track: { name: 'Go-Kart Track', cost: 1000, description: 'Racing entertainment (2x2)', size: 2 },
  amphitheater: { name: 'Amphitheater', cost: 1500, description: 'Outdoor performance venue (2x2)', size: 2 },
  greenhouse_garden: { name: 'Greenhouse Garden', cost: 800, description: 'Botanical greenhouse (2x2)', size: 2 },
  animal_pens_farm: { name: 'Animal Pens', cost: 400, description: 'Petting zoo / farm animals', size: 1 },
  cabin_house: { name: 'Cabin House', cost: 300, description: 'Rustic cabin retreat', size: 1 },
  campground: { name: 'Campground', cost: 250, description: 'Outdoor camping area', size: 1 },
  marina_docks_small: { name: 'Marina', cost: 1200, description: 'Boat docks (2x2, must be placed next to water)', size: 2 },
  pier_large: { name: 'Pier', cost: 600, description: 'Waterfront pier (must be placed next to water)', size: 1 },
  roller_coaster_small: { name: 'Roller Coaster', cost: 3000, description: 'Thrill ride (2x2)', size: 2 },
  community_garden: { name: 'Community Garden', cost: 200, description: 'Shared gardening space', size: 1 },
  pond_park: { name: 'Pond Park', cost: 350, description: 'Park with scenic pond', size: 1 },
  park_gate: { name: 'Park Gate', cost: 150, description: 'Decorative park entrance', size: 1 },
  mountain_lodge: { name: 'Mountain Lodge', cost: 1500, description: 'Nature retreat lodge (2x2)', size: 2 },
  mountain_trailhead: { name: 'Trailhead', cost: 400, description: 'Hiking trail entrance (3x3)', size: 3 },
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
  constructionProgress: number; // 0-100, building is under construction until 100
  abandoned: boolean; // Building is abandoned due to low demand, produces nothing
  flipped?: boolean; // Horizontally mirror the sprite (used for waterfront buildings to face water)
  /**
   * Competitive mode extensions
   * - ownerId: which player controls this building (set on the origin tile for multi-tile buildings)
   * - hp/maxHp: used for RTS combat; when hp reaches 0, the building is destroyed (converted to grass)
   */
  ownerId?: string;
  hp?: number;
  maxHp?: number;
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
  hasSubway: boolean;
  hasRailOverlay?: boolean; // Rail tracks overlaid on road (road base with rail tracks on top)
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
  discovered: boolean; // City becomes discovered when a road reaches its edge
}

export interface WaterBody {
  id: string;
  name: string;
  type: 'lake' | 'ocean';
  tiles: { x: number; y: number }[];
  centerX: number;
  centerY: number;
}

export interface GameState {
  id: string; // Unique UUID for this game
  grid: Tile[][];
  gridSize: number;
  cityName: string;
  year: number;
  month: number;
  day: number;
  hour: number; // 0-23 for day/night cycle
  tick: number;
  speed: 0 | 1 | 2 | 3;
  selectedTool: Tool;
  taxRate: number;
  effectiveTaxRate: number; // Lagging tax rate that gradually moves toward taxRate (affects demand)
  stats: Stats;
  budget: Budget;
  services: ServiceCoverage;
  notifications: Notification[];
  advisorMessages: AdvisorMessage[];
  history: HistoryPoint[];
  activePanel: 'none' | 'budget' | 'statistics' | 'advisors' | 'settings';
  disastersEnabled: boolean;
  adjacentCities: AdjacentCity[];
  waterBodies: WaterBody[];
  gameVersion: number; // Increments when a new game starts - used to clear transient state like vehicles

  /**
   * Game mode
   * - sandbox: classic SimCity-like mode (default)
   * - competitive: RTS-like mode with players/units/fog
   */
  gameMode?: 'sandbox' | 'competitive';

  /** Competitive mode state (present only when gameMode === 'competitive') */
  competitive?: CompetitiveState;
}

// ============================================================================
// Competitive / RTS Mode Types
// ============================================================================

export type PlayerId = string;

export type CompetitiveUnitType = 'infantry' | 'tank' | 'helicopter';

export type UnitOrder =
  | { kind: 'idle' }
  | { kind: 'move'; target: { x: number; y: number } }
  | { kind: 'attack'; target: { x: number; y: number } };

export interface CompetitiveUnit {
  id: string;
  ownerId: PlayerId;
  type: CompetitiveUnitType;
  // Position in tile space (fractional allowed for movement smoothing)
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  // Movement/combat tuning
  speedTilesPerTick: number;
  attackRangeTiles: number;
  attackDamagePerTick: number;
  igniteChancePerHit: number; // 0-1
  order: UnitOrder;
}

export interface CompetitivePlayer {
  id: PlayerId;
  name: string;
  color: string;
  isHuman: boolean;
  eliminated: boolean;
  money: number;
  score: number;
  techLevel: 1 | 2 | 3;
  base: { x: number; y: number }; // city hall origin tile
  ai?: {
    nextSpawnTick: number;
    nextAttackTick: number;
  };
}

export interface CompetitiveFog {
  /**
   * Fog-of-war for the human player only (true = explored/revealed).
   * This keeps memory and CPU predictable vs per-player fog.
   */
  revealed: boolean[][];
}

export interface CompetitiveState {
  humanPlayerId: PlayerId;
  players: CompetitivePlayer[];
  units: CompetitiveUnit[];
  fog: CompetitiveFog;
  lastIdCounter: number; // deterministic-ish ID source
}

// Saved city metadata for the multi-save system
export interface SavedCityMeta {
  id: string; // Same as GameState.id
  cityName: string;
  population: number;
  money: number;
  year: number;
  month: number;
  gridSize: number;
  savedAt: number; // timestamp
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
  rail: { maxPop: 0, maxJobs: 0, pollution: 1, landValue: -2 },
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
  subway_station: { maxPop: 0, maxJobs: 15, pollution: 0, landValue: 25 },
  rail_station: { maxPop: 0, maxJobs: 25, pollution: 2, landValue: 20 },
  city_hall: { maxPop: 0, maxJobs: 60, pollution: 0, landValue: 50 },
  amusement_park: { maxPop: 0, maxJobs: 100, pollution: 8, landValue: 60 },
  // Parks (new sprite sheet)
  basketball_courts: { maxPop: 0, maxJobs: 2, pollution: -3, landValue: 12 },
  playground_small: { maxPop: 0, maxJobs: 1, pollution: -5, landValue: 15 },
  playground_large: { maxPop: 0, maxJobs: 2, pollution: -8, landValue: 18 },
  baseball_field_small: { maxPop: 0, maxJobs: 4, pollution: -10, landValue: 25 },
  soccer_field_small: { maxPop: 0, maxJobs: 2, pollution: -5, landValue: 15 },
  football_field: { maxPop: 0, maxJobs: 8, pollution: -8, landValue: 30 },
  baseball_stadium: { maxPop: 0, maxJobs: 60, pollution: 5, landValue: 45 },
  community_center: { maxPop: 0, maxJobs: 10, pollution: 0, landValue: 20 },
  office_building_small: { maxPop: 0, maxJobs: 25, pollution: 1, landValue: 22 },
  swimming_pool: { maxPop: 0, maxJobs: 5, pollution: -5, landValue: 18 },
  skate_park: { maxPop: 0, maxJobs: 2, pollution: -3, landValue: 12 },
  mini_golf_course: { maxPop: 0, maxJobs: 6, pollution: -8, landValue: 22 },
  bleachers_field: { maxPop: 0, maxJobs: 3, pollution: -5, landValue: 15 },
  go_kart_track: { maxPop: 0, maxJobs: 10, pollution: 5, landValue: 20 },
  amphitheater: { maxPop: 0, maxJobs: 15, pollution: -5, landValue: 35 },
  greenhouse_garden: { maxPop: 0, maxJobs: 8, pollution: -15, landValue: 28 },
  animal_pens_farm: { maxPop: 0, maxJobs: 4, pollution: 2, landValue: 10 },
  cabin_house: { maxPop: 4, maxJobs: 0, pollution: -3, landValue: 15 },
  campground: { maxPop: 0, maxJobs: 3, pollution: -8, landValue: 12 },
  marina_docks_small: { maxPop: 0, maxJobs: 8, pollution: 2, landValue: 25 },
  pier_large: { maxPop: 0, maxJobs: 12, pollution: 1, landValue: 30 },
  roller_coaster_small: { maxPop: 0, maxJobs: 20, pollution: 3, landValue: 40 },
  community_garden: { maxPop: 0, maxJobs: 2, pollution: -12, landValue: 18 },
  pond_park: { maxPop: 0, maxJobs: 2, pollution: -15, landValue: 22 },
  park_gate: { maxPop: 0, maxJobs: 1, pollution: -2, landValue: 8 },
  mountain_lodge: { maxPop: 0, maxJobs: 15, pollution: -5, landValue: 35 },
  mountain_trailhead: { maxPop: 0, maxJobs: 2, pollution: -10, landValue: 15 },
};
