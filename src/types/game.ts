// Game type definitions for IsoCity

import { msg } from 'gt-next';

export type BuildingType =
  | 'empty'
  | 'grass'
  | 'water'
  | 'road'
  | 'bridge'
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
  | 'expand_city'
  | 'shrink_city'
  | 'tree'
  | 'zone_residential'
  | 'zone_commercial'
  | 'zone_industrial'
  | 'zone_dezone'
  | 'zone_water'
  | 'zone_land'
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
  select: { name: msg('Select'), cost: 0, description: msg('Click to view tile info') },
  bulldoze: { name: msg('Bulldoze'), cost: 10, description: msg('Remove buildings and zones') },
  road: { name: msg('Road'), cost: 25, description: msg('Connect your city') },
  rail: { name: msg('Rail'), cost: 40, description: msg('Build railway tracks') },
  subway: { name: msg('Subway'), cost: 50, description: msg('Underground transit') },
  expand_city: { name: msg('Expand City'), cost: 0, description: msg('Add 15 tiles to each edge') },
  shrink_city: { name: msg('Shrink City'), cost: 0, description: msg('Remove 15 tiles from each edge') },
  tree: { name: msg('Tree'), cost: 15, description: msg('Plant trees to improve environment') },
  zone_residential: { name: msg('Residential'), cost: 50, description: msg('Zone for housing') },
  zone_commercial: { name: msg('Commercial'), cost: 50, description: msg('Zone for shops and offices') },
  zone_industrial: { name: msg('Industrial'), cost: 50, description: msg('Zone for factories') },
  zone_dezone: { name: msg('De-zone'), cost: 0, description: msg('Remove zoning') },
  zone_water: { name: msg('Water Terraform'), cost: 50000, description: msg('Terraform land into water') },
  zone_land: { name: msg('Land Terraform'), cost: 50000, description: msg('Terraform water into land') },
  police_station: { name: msg('Police'), cost: 500, description: msg('Increase safety'), size: 1 },
  fire_station: { name: msg('Fire Station'), cost: 500, description: msg('Fight fires'), size: 1 },
  hospital: { name: msg('Hospital'), cost: 1000, description: msg('Improve health (2x2)'), size: 2 },
  school: { name: msg('School'), cost: 400, description: msg('Basic education (2x2)'), size: 2 },
  university: { name: msg('University'), cost: 2000, description: msg('Higher education (3x3)'), size: 3 },
  park: { name: msg('Small Park'), cost: 150, description: msg('Boost happiness and land value (1x1)'), size: 1 },
  park_large: { name: msg('Large Park'), cost: 600, description: msg('Large park (3x3)'), size: 3 },
  tennis: { name: msg('Tennis Court'), cost: 200, description: msg('Recreation facility'), size: 1 },
  power_plant: { name: msg('Power Plant'), cost: 3000, description: msg('Generate electricity (2x2)'), size: 2 },
  water_tower: { name: msg('Water Tower'), cost: 1000, description: msg('Provide water'), size: 1 },
  subway_station: { name: msg('Subway Station'), cost: 750, description: msg('Access to subway network'), size: 1 },
  rail_station: { name: msg('Rail Station'), cost: 1000, description: msg('Passenger and freight station'), size: 2 },
  stadium: { name: msg('Stadium'), cost: 5000, description: msg('Boosts commercial demand (3x3)'), size: 3 },
  museum: { name: msg('Museum'), cost: 4000, description: msg('Boosts commercial & residential demand (3x3)'), size: 3 },
  airport: { name: msg('Airport'), cost: 10000, description: msg('Boosts commercial & industrial demand (4x4)'), size: 4 },
  space_program: { name: msg('Space Program'), cost: 15000, description: msg('Boosts industrial & residential demand (3x3)'), size: 3 },
  city_hall: { name: msg('City Hall'), cost: 6000, description: msg('Boosts all demand types (2x2)'), size: 2 },
  amusement_park: { name: msg('Amusement Park'), cost: 12000, description: msg('Major boost to commercial demand (4x4)'), size: 4 },
  // Parks (new sprite sheet)
  basketball_courts: { name: msg('Basketball Courts'), cost: 250, description: msg('Outdoor basketball facility'), size: 1 },
  playground_small: { name: msg('Small Playground'), cost: 200, description: msg('Children\'s playground'), size: 1 },
  playground_large: { name: msg('Large Playground'), cost: 350, description: msg('Large playground with more equipment (2x2)'), size: 2 },
  baseball_field_small: { name: msg('Baseball Field'), cost: 800, description: msg('Local baseball diamond (2x2)'), size: 2 },
  soccer_field_small: { name: msg('Soccer Field'), cost: 400, description: msg('Soccer/football pitch'), size: 1 },
  football_field: { name: msg('Football Field'), cost: 1200, description: msg('Football stadium (2x2)'), size: 2 },
  baseball_stadium: { name: msg('Baseball Stadium'), cost: 6000, description: msg('Professional baseball venue (3x3)'), size: 3 },
  community_center: { name: msg('Community Center'), cost: 500, description: msg('Local community hub'), size: 1 },
  office_building_small: { name: msg('Small Office'), cost: 600, description: msg('Small office building'), size: 1 },
  swimming_pool: { name: msg('Swimming Pool'), cost: 450, description: msg('Public swimming facility'), size: 1 },
  skate_park: { name: msg('Skate Park'), cost: 300, description: msg('Skateboarding park'), size: 1 },
  mini_golf_course: { name: msg('Mini Golf'), cost: 700, description: msg('Miniature golf course (2x2)'), size: 2 },
  bleachers_field: { name: msg('Bleachers Field'), cost: 350, description: msg('Sports field with seating'), size: 1 },
  go_kart_track: { name: msg('Go-Kart Track'), cost: 1000, description: msg('Racing entertainment (2x2)'), size: 2 },
  amphitheater: { name: msg('Amphitheater'), cost: 1500, description: msg('Outdoor performance venue (2x2)'), size: 2 },
  greenhouse_garden: { name: msg('Greenhouse Garden'), cost: 800, description: msg('Botanical greenhouse (2x2)'), size: 2 },
  animal_pens_farm: { name: msg('Animal Pens'), cost: 400, description: msg('Petting zoo / farm animals'), size: 1 },
  cabin_house: { name: msg('Cabin House'), cost: 300, description: msg('Rustic cabin retreat'), size: 1 },
  campground: { name: msg('Campground'), cost: 250, description: msg('Outdoor camping area'), size: 1 },
  marina_docks_small: { name: msg('Marina'), cost: 1200, description: msg('Boat docks (2x2, must be placed next to water)'), size: 2 },
  pier_large: { name: msg('Pier'), cost: 600, description: msg('Waterfront pier (must be placed next to water)'), size: 1 },
  roller_coaster_small: { name: msg('Roller Coaster'), cost: 3000, description: msg('Thrill ride (2x2)'), size: 2 },
  community_garden: { name: msg('Community Garden'), cost: 200, description: msg('Shared gardening space'), size: 1 },
  pond_park: { name: msg('Pond Park'), cost: 350, description: msg('Park with scenic pond'), size: 1 },
  park_gate: { name: msg('Park Gate'), cost: 150, description: msg('Decorative park entrance'), size: 1 },
  mountain_lodge: { name: msg('Mountain Lodge'), cost: 1500, description: msg('Nature retreat lodge (2x2)'), size: 2 },
  mountain_trailhead: { name: msg('Trailhead'), cost: 400, description: msg('Hiking trail entrance (3x3)'), size: 3 },
};

// Bridge type based on span width
export type BridgeType = 'small' | 'medium' | 'large' | 'suspension';

// Bridge orientation
export type BridgeOrientation = 'ns' | 'ew';

// What the bridge carries (road or rail)
export type BridgeTrackType = 'road' | 'rail';

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
  cityId?: string; // ID of the city this building belongs to (for multi-city support)
  // Bridge-specific properties
  bridgeType?: BridgeType; // Type of bridge (small, medium, large, suspension)
  bridgeOrientation?: BridgeOrientation; // Direction the bridge spans (ns or ew)
  bridgeVariant?: number; // Visual variant for this bridge type (0-2)
  bridgePosition?: 'start' | 'middle' | 'end'; // Position within the bridge span
  bridgeIndex?: number; // Index of this tile within the bridge (0-based)
  bridgeSpan?: number; // Total number of tiles in this bridge
  bridgeTrackType?: BridgeTrackType; // What the bridge carries: 'road' or 'rail'
}

// City definition for multi-city maps
export interface City {
  id: string;
  name: string;
  // Bounds of the city (inclusive tile coordinates)
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
  // Economy stats (cached for performance)
  economy: CityEconomy;
  // City color for border rendering
  color: string;
}

// Cached economy data for a city
export interface CityEconomy {
  population: number;
  jobs: number;
  income: number;
  expenses: number;
  happiness: number;
  // Timestamp of last calculation for cache invalidation
  lastCalculated: number;
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
  activePanel: 'none' | 'budget' | 'statistics' | 'advisors' | 'settings' | 'regions' | 'market' | 'great_works';
  disastersEnabled: boolean;
  adjacentCities: AdjacentCity[];
  waterBodies: WaterBody[];
  gameVersion: number; // Increments when a new game starts - used to clear transient state like vehicles
  cities: City[]; // Cities in the map (for multi-city support)
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
  bridge: { maxPop: 0, maxJobs: 0, pollution: 1, landValue: 5 },
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
