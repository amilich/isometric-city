/**
 * Coaster Tycoon Building Types
 * Defines all placeable structures in the theme park
 */

import { msg } from 'gt-next';

// =============================================================================
// PATH TYPES
// =============================================================================

export type PathSurface = 'tarmac' | 'dirt' | 'crazy_paving' | 'tile';
export type PathType = 'standard' | 'queue';

export interface PathConfig {
  surface: PathSurface;
  type: PathType;
  hasRailings: boolean;
}

// =============================================================================
// RIDE CATEGORIES
// =============================================================================

export type RideCategory = 
  | 'transport'    // Trains, monorails, chairlifts
  | 'gentle'       // Carousel, Ferris wheel, etc.
  | 'thrill'       // Drop towers, swinging ships, etc.
  | 'water'        // Log flume, rapids, etc.
  | 'coaster';     // All roller coasters

// =============================================================================
// RIDE TYPES
// =============================================================================

export type GentleRideType =
  | 'carousel'
  | 'ferris_wheel'
  | 'observation_tower'
  | 'spiral_slide'
  | 'merry_go_round'
  | 'haunted_house'
  | 'circus_show'
  | 'mini_golf'
  | 'dodgems'         // Bumper cars
  | 'flying_saucers'
  | 'maze'
  | 'mini_train';

export type ThrillRideType =
  | 'swinging_ship'
  | 'swinging_inverter_ship'
  | 'top_spin'
  | 'twist'
  | 'motion_simulator'
  | 'go_karts'
  | 'launched_freefall'  // Drop tower
  | 'enterprise'
  | 'roto_drop'
  | 'scrambled_eggs';

export type WaterRideType =
  | 'log_flume'
  | 'river_rapids'
  | 'splash_boats'
  | 'rowing_boats'
  | 'canoes'
  | 'dinghy_slide'
  | 'water_coaster';

export type TransportRideType =
  | 'miniature_railway'
  | 'monorail'
  | 'suspended_monorail'
  | 'chairlift'
  | 'elevator';

export type CoasterType =
  | 'wooden_coaster'
  | 'steel_coaster'
  | 'corkscrew_coaster'
  | 'vertical_drop_coaster'
  | 'inverted_coaster'
  | 'suspended_coaster'
  | 'looping_coaster'
  | 'stand_up_coaster'
  | 'flying_coaster'
  | 'bobsled_coaster'
  | 'mine_train_coaster'
  | 'hypercoaster'
  | 'junior_coaster'
  | 'spiral_coaster'
  | 'wild_mouse'
  | 'multi_dimension_coaster';

export type RideType = 
  | GentleRideType 
  | ThrillRideType 
  | WaterRideType 
  | TransportRideType 
  | CoasterType;

// =============================================================================
// RIDE DEFINITIONS
// =============================================================================

export interface RideDefinition {
  type: RideType;
  category: RideCategory;
  name: string;
  description: string;
  buildCost: number;
  runningCostPerHour: number;
  size: { width: number; height: number }; // For flat rides
  isTracked: boolean; // True for coasters and transport
  defaultCapacity: number;
  defaultRideTime: number; // seconds
  excitementBase: number;
  intensityBase: number;
  nauseaBase: number;
  minHeight?: number; // For tracked rides
  maxHeight?: number;
}

export const RIDE_DEFINITIONS: Record<RideType, RideDefinition> = {
  // Gentle Rides
  carousel: {
    type: 'carousel',
    category: 'gentle',
    name: msg('Carousel'),
    description: msg('A classic merry-go-round with painted horses'),
    buildCost: 8000,
    runningCostPerHour: 50,
    size: { width: 2, height: 2 },
    isTracked: false,
    defaultCapacity: 16,
    defaultRideTime: 120,
    excitementBase: 2.4,
    intensityBase: 0.8,
    nauseaBase: 0.5,
  },
  ferris_wheel: {
    type: 'ferris_wheel',
    category: 'gentle',
    name: msg('Ferris Wheel'),
    description: msg('A giant observation wheel with panoramic views'),
    buildCost: 12000,
    runningCostPerHour: 60,
    size: { width: 3, height: 3 },
    isTracked: false,
    defaultCapacity: 24,
    defaultRideTime: 180,
    excitementBase: 3.0,
    intensityBase: 0.5,
    nauseaBase: 0.2,
  },
  observation_tower: {
    type: 'observation_tower',
    category: 'gentle',
    name: msg('Observation Tower'),
    description: msg('A rotating tower with amazing views'),
    buildCost: 15000,
    runningCostPerHour: 70,
    size: { width: 1, height: 1 },
    isTracked: false,
    defaultCapacity: 20,
    defaultRideTime: 150,
    excitementBase: 2.8,
    intensityBase: 0.6,
    nauseaBase: 0.3,
  },
  spiral_slide: {
    type: 'spiral_slide',
    category: 'gentle',
    name: msg('Spiral Slide'),
    description: msg('A tall slide that spirals down'),
    buildCost: 5000,
    runningCostPerHour: 20,
    size: { width: 1, height: 1 },
    isTracked: false,
    defaultCapacity: 1,
    defaultRideTime: 15,
    excitementBase: 1.5,
    intensityBase: 1.0,
    nauseaBase: 0.3,
  },
  merry_go_round: {
    type: 'merry_go_round',
    category: 'gentle',
    name: msg('Merry-Go-Round'),
    description: msg('A spinning platform with seats'),
    buildCost: 4500,
    runningCostPerHour: 30,
    size: { width: 2, height: 2 },
    isTracked: false,
    defaultCapacity: 12,
    defaultRideTime: 90,
    excitementBase: 1.8,
    intensityBase: 0.6,
    nauseaBase: 0.4,
  },
  haunted_house: {
    type: 'haunted_house',
    category: 'gentle',
    name: msg('Haunted House'),
    description: msg('A spooky dark ride through scary scenes'),
    buildCost: 25000,
    runningCostPerHour: 100,
    size: { width: 3, height: 3 },
    isTracked: false,
    defaultCapacity: 8,
    defaultRideTime: 180,
    excitementBase: 4.5,
    intensityBase: 2.5,
    nauseaBase: 0.8,
  },
  circus_show: {
    type: 'circus_show',
    category: 'gentle',
    name: msg('Circus Show'),
    description: msg('A live circus performance in a big top'),
    buildCost: 20000,
    runningCostPerHour: 200,
    size: { width: 4, height: 4 },
    isTracked: false,
    defaultCapacity: 100,
    defaultRideTime: 600,
    excitementBase: 5.0,
    intensityBase: 1.0,
    nauseaBase: 0.0,
  },
  mini_golf: {
    type: 'mini_golf',
    category: 'gentle',
    name: msg('Mini Golf'),
    description: msg('An 18-hole miniature golf course'),
    buildCost: 15000,
    runningCostPerHour: 40,
    size: { width: 4, height: 4 },
    isTracked: false,
    defaultCapacity: 18,
    defaultRideTime: 900,
    excitementBase: 2.5,
    intensityBase: 0.2,
    nauseaBase: 0.0,
  },
  dodgems: {
    type: 'dodgems',
    category: 'gentle',
    name: msg('Bumper Cars'),
    description: msg('Electric cars that bump into each other'),
    buildCost: 10000,
    runningCostPerHour: 80,
    size: { width: 3, height: 3 },
    isTracked: false,
    defaultCapacity: 12,
    defaultRideTime: 180,
    excitementBase: 3.2,
    intensityBase: 1.5,
    nauseaBase: 0.4,
  },
  flying_saucers: {
    type: 'flying_saucers',
    category: 'gentle',
    name: msg('Flying Saucers'),
    description: msg('Hover cars on an air cushion'),
    buildCost: 18000,
    runningCostPerHour: 90,
    size: { width: 3, height: 3 },
    isTracked: false,
    defaultCapacity: 10,
    defaultRideTime: 120,
    excitementBase: 3.5,
    intensityBase: 1.2,
    nauseaBase: 0.3,
  },
  maze: {
    type: 'maze',
    category: 'gentle',
    name: msg('Hedge Maze'),
    description: msg('A traditional hedge maze to get lost in'),
    buildCost: 8000,
    runningCostPerHour: 10,
    size: { width: 5, height: 5 },
    isTracked: false,
    defaultCapacity: 50,
    defaultRideTime: 600,
    excitementBase: 2.0,
    intensityBase: 0.3,
    nauseaBase: 0.0,
  },
  mini_train: {
    type: 'mini_train',
    category: 'gentle',
    name: msg('Mini Train'),
    description: msg('A small train ride around the park'),
    buildCost: 6000,
    runningCostPerHour: 40,
    size: { width: 2, height: 1 },
    isTracked: true,
    defaultCapacity: 12,
    defaultRideTime: 180,
    excitementBase: 2.2,
    intensityBase: 0.4,
    nauseaBase: 0.2,
  },

  // Thrill Rides
  swinging_ship: {
    type: 'swinging_ship',
    category: 'thrill',
    name: msg('Swinging Ship'),
    description: msg('A pirate ship that swings back and forth'),
    buildCost: 12000,
    runningCostPerHour: 70,
    size: { width: 2, height: 3 },
    isTracked: false,
    defaultCapacity: 20,
    defaultRideTime: 120,
    excitementBase: 4.5,
    intensityBase: 4.0,
    nauseaBase: 2.5,
  },
  swinging_inverter_ship: {
    type: 'swinging_inverter_ship',
    category: 'thrill',
    name: msg('Inverter Ship'),
    description: msg('A ship that swings and goes upside down'),
    buildCost: 25000,
    runningCostPerHour: 100,
    size: { width: 2, height: 3 },
    isTracked: false,
    defaultCapacity: 16,
    defaultRideTime: 120,
    excitementBase: 6.0,
    intensityBase: 7.0,
    nauseaBase: 5.5,
  },
  top_spin: {
    type: 'top_spin',
    category: 'thrill',
    name: msg('Top Spin'),
    description: msg('A ride that flips guests in multiple axes'),
    buildCost: 22000,
    runningCostPerHour: 90,
    size: { width: 2, height: 2 },
    isTracked: false,
    defaultCapacity: 16,
    defaultRideTime: 90,
    excitementBase: 5.5,
    intensityBase: 6.5,
    nauseaBase: 5.0,
  },
  twist: {
    type: 'twist',
    category: 'thrill',
    name: msg('Twist'),
    description: msg('A spinning and tilting platform ride'),
    buildCost: 8000,
    runningCostPerHour: 50,
    size: { width: 2, height: 2 },
    isTracked: false,
    defaultCapacity: 24,
    defaultRideTime: 120,
    excitementBase: 3.8,
    intensityBase: 3.5,
    nauseaBase: 3.0,
  },
  motion_simulator: {
    type: 'motion_simulator',
    category: 'thrill',
    name: msg('Motion Simulator'),
    description: msg('A virtual reality motion experience'),
    buildCost: 30000,
    runningCostPerHour: 150,
    size: { width: 2, height: 2 },
    isTracked: false,
    defaultCapacity: 8,
    defaultRideTime: 300,
    excitementBase: 5.0,
    intensityBase: 4.0,
    nauseaBase: 3.5,
  },
  go_karts: {
    type: 'go_karts',
    category: 'thrill',
    name: msg('Go Karts'),
    description: msg('Racing karts on a track'),
    buildCost: 15000,
    runningCostPerHour: 100,
    size: { width: 4, height: 4 },
    isTracked: true,
    defaultCapacity: 8,
    defaultRideTime: 300,
    excitementBase: 4.5,
    intensityBase: 2.5,
    nauseaBase: 0.5,
  },
  launched_freefall: {
    type: 'launched_freefall',
    category: 'thrill',
    name: msg('Drop Tower'),
    description: msg('A tower that drops guests from great height'),
    buildCost: 35000,
    runningCostPerHour: 120,
    size: { width: 1, height: 1 },
    isTracked: false,
    defaultCapacity: 16,
    defaultRideTime: 60,
    excitementBase: 6.5,
    intensityBase: 8.0,
    nauseaBase: 3.0,
  },
  enterprise: {
    type: 'enterprise',
    category: 'thrill',
    name: msg('Enterprise'),
    description: msg('A spinning wheel that goes vertical'),
    buildCost: 20000,
    runningCostPerHour: 80,
    size: { width: 2, height: 2 },
    isTracked: false,
    defaultCapacity: 20,
    defaultRideTime: 120,
    excitementBase: 5.0,
    intensityBase: 5.5,
    nauseaBase: 4.0,
  },
  roto_drop: {
    type: 'roto_drop',
    category: 'thrill',
    name: msg('Roto-Drop'),
    description: msg('A spinning drop tower'),
    buildCost: 28000,
    runningCostPerHour: 100,
    size: { width: 1, height: 1 },
    isTracked: false,
    defaultCapacity: 12,
    defaultRideTime: 90,
    excitementBase: 5.8,
    intensityBase: 7.5,
    nauseaBase: 4.5,
  },
  scrambled_eggs: {
    type: 'scrambled_eggs',
    category: 'thrill',
    name: msg('Scrambler'),
    description: msg('Spinning arms with spinning pods'),
    buildCost: 12000,
    runningCostPerHour: 60,
    size: { width: 2, height: 2 },
    isTracked: false,
    defaultCapacity: 16,
    defaultRideTime: 120,
    excitementBase: 4.0,
    intensityBase: 4.5,
    nauseaBase: 4.0,
  },

  // Water Rides
  log_flume: {
    type: 'log_flume',
    category: 'water',
    name: msg('Log Flume'),
    description: msg('Log boats that splash down water drops'),
    buildCost: 40000,
    runningCostPerHour: 100,
    size: { width: 2, height: 1 },
    isTracked: true,
    defaultCapacity: 6,
    defaultRideTime: 240,
    excitementBase: 5.5,
    intensityBase: 4.0,
    nauseaBase: 1.5,
  },
  river_rapids: {
    type: 'river_rapids',
    category: 'water',
    name: msg('River Rapids'),
    description: msg('Circular boats on a turbulent river'),
    buildCost: 50000,
    runningCostPerHour: 120,
    size: { width: 2, height: 2 },
    isTracked: true,
    defaultCapacity: 8,
    defaultRideTime: 300,
    excitementBase: 6.0,
    intensityBase: 4.5,
    nauseaBase: 2.0,
  },
  splash_boats: {
    type: 'splash_boats',
    category: 'water',
    name: msg('Splash Boats'),
    description: msg('Boats that make big splashes'),
    buildCost: 45000,
    runningCostPerHour: 110,
    size: { width: 2, height: 1 },
    isTracked: true,
    defaultCapacity: 8,
    defaultRideTime: 270,
    excitementBase: 5.8,
    intensityBase: 4.2,
    nauseaBase: 1.8,
  },
  rowing_boats: {
    type: 'rowing_boats',
    category: 'water',
    name: msg('Rowing Boats'),
    description: msg('Self-powered rowing boats on a lake'),
    buildCost: 8000,
    runningCostPerHour: 20,
    size: { width: 3, height: 3 },
    isTracked: false,
    defaultCapacity: 4,
    defaultRideTime: 600,
    excitementBase: 2.0,
    intensityBase: 0.5,
    nauseaBase: 0.2,
  },
  canoes: {
    type: 'canoes',
    category: 'water',
    name: msg('Canoes'),
    description: msg('Paddle your own canoe on a lazy river'),
    buildCost: 6000,
    runningCostPerHour: 15,
    size: { width: 3, height: 3 },
    isTracked: false,
    defaultCapacity: 2,
    defaultRideTime: 600,
    excitementBase: 1.8,
    intensityBase: 0.4,
    nauseaBase: 0.1,
  },
  dinghy_slide: {
    type: 'dinghy_slide',
    category: 'water',
    name: msg('Dinghy Slide'),
    description: msg('Inflatable dinghies on water slides'),
    buildCost: 25000,
    runningCostPerHour: 80,
    size: { width: 2, height: 1 },
    isTracked: true,
    defaultCapacity: 2,
    defaultRideTime: 60,
    excitementBase: 4.5,
    intensityBase: 3.5,
    nauseaBase: 2.0,
  },
  water_coaster: {
    type: 'water_coaster',
    category: 'water',
    name: msg('Water Coaster'),
    description: msg('A coaster that goes through water'),
    buildCost: 60000,
    runningCostPerHour: 150,
    size: { width: 2, height: 1 },
    isTracked: true,
    defaultCapacity: 8,
    defaultRideTime: 180,
    excitementBase: 6.5,
    intensityBase: 5.0,
    nauseaBase: 2.5,
  },

  // Transport Rides
  miniature_railway: {
    type: 'miniature_railway',
    category: 'transport',
    name: msg('Miniature Railway'),
    description: msg('A scenic train ride around the park'),
    buildCost: 15000,
    runningCostPerHour: 60,
    size: { width: 2, height: 1 },
    isTracked: true,
    defaultCapacity: 24,
    defaultRideTime: 300,
    excitementBase: 3.0,
    intensityBase: 0.8,
    nauseaBase: 0.3,
  },
  monorail: {
    type: 'monorail',
    category: 'transport',
    name: msg('Monorail'),
    description: msg('An elevated monorail system'),
    buildCost: 30000,
    runningCostPerHour: 100,
    size: { width: 1, height: 1 },
    isTracked: true,
    defaultCapacity: 32,
    defaultRideTime: 300,
    excitementBase: 3.5,
    intensityBase: 0.6,
    nauseaBase: 0.2,
  },
  suspended_monorail: {
    type: 'suspended_monorail',
    category: 'transport',
    name: msg('Suspended Monorail'),
    description: msg('A monorail hanging from the track'),
    buildCost: 35000,
    runningCostPerHour: 110,
    size: { width: 1, height: 1 },
    isTracked: true,
    defaultCapacity: 24,
    defaultRideTime: 300,
    excitementBase: 4.0,
    intensityBase: 1.0,
    nauseaBase: 0.5,
  },
  chairlift: {
    type: 'chairlift',
    category: 'transport',
    name: msg('Chairlift'),
    description: msg('An open-air ski lift style ride'),
    buildCost: 20000,
    runningCostPerHour: 50,
    size: { width: 1, height: 1 },
    isTracked: true,
    defaultCapacity: 2,
    defaultRideTime: 240,
    excitementBase: 3.2,
    intensityBase: 1.5,
    nauseaBase: 0.3,
  },
  elevator: {
    type: 'elevator',
    category: 'transport',
    name: msg('Elevator'),
    description: msg('A vertical lift between levels'),
    buildCost: 10000,
    runningCostPerHour: 30,
    size: { width: 1, height: 1 },
    isTracked: false,
    defaultCapacity: 8,
    defaultRideTime: 30,
    excitementBase: 1.0,
    intensityBase: 0.5,
    nauseaBase: 0.1,
  },

  // Roller Coasters
  wooden_coaster: {
    type: 'wooden_coaster',
    category: 'coaster',
    name: msg('Wooden Roller Coaster'),
    description: msg('A classic wooden coaster with rattling tracks'),
    buildCost: 50000,
    runningCostPerHour: 150,
    size: { width: 2, height: 1 },
    isTracked: true,
    defaultCapacity: 24,
    defaultRideTime: 120,
    excitementBase: 5.5,
    intensityBase: 5.0,
    nauseaBase: 2.5,
    minHeight: 0,
    maxHeight: 30,
  },
  steel_coaster: {
    type: 'steel_coaster',
    category: 'coaster',
    name: msg('Steel Roller Coaster'),
    description: msg('A smooth steel track coaster'),
    buildCost: 55000,
    runningCostPerHour: 160,
    size: { width: 2, height: 1 },
    isTracked: true,
    defaultCapacity: 24,
    defaultRideTime: 120,
    excitementBase: 5.8,
    intensityBase: 5.5,
    nauseaBase: 2.8,
    minHeight: 0,
    maxHeight: 40,
  },
  corkscrew_coaster: {
    type: 'corkscrew_coaster',
    category: 'coaster',
    name: msg('Corkscrew Coaster'),
    description: msg('A coaster with corkscrew inversions'),
    buildCost: 65000,
    runningCostPerHour: 180,
    size: { width: 2, height: 1 },
    isTracked: true,
    defaultCapacity: 20,
    defaultRideTime: 90,
    excitementBase: 6.5,
    intensityBase: 6.5,
    nauseaBase: 4.0,
    minHeight: 0,
    maxHeight: 35,
  },
  vertical_drop_coaster: {
    type: 'vertical_drop_coaster',
    category: 'coaster',
    name: msg('Vertical Drop Coaster'),
    description: msg('Features a 90-degree drop'),
    buildCost: 80000,
    runningCostPerHour: 200,
    size: { width: 2, height: 1 },
    isTracked: true,
    defaultCapacity: 16,
    defaultRideTime: 80,
    excitementBase: 7.5,
    intensityBase: 8.0,
    nauseaBase: 3.5,
    minHeight: 0,
    maxHeight: 50,
  },
  inverted_coaster: {
    type: 'inverted_coaster',
    category: 'coaster',
    name: msg('Inverted Coaster'),
    description: msg('Riders hang below the track'),
    buildCost: 70000,
    runningCostPerHour: 190,
    size: { width: 2, height: 1 },
    isTracked: true,
    defaultCapacity: 20,
    defaultRideTime: 100,
    excitementBase: 7.0,
    intensityBase: 7.0,
    nauseaBase: 4.5,
    minHeight: 0,
    maxHeight: 45,
  },
  suspended_coaster: {
    type: 'suspended_coaster',
    category: 'coaster',
    name: msg('Suspended Coaster'),
    description: msg('Swinging cars on a suspended track'),
    buildCost: 60000,
    runningCostPerHour: 170,
    size: { width: 2, height: 1 },
    isTracked: true,
    defaultCapacity: 20,
    defaultRideTime: 110,
    excitementBase: 6.2,
    intensityBase: 5.8,
    nauseaBase: 4.0,
    minHeight: 0,
    maxHeight: 35,
  },
  looping_coaster: {
    type: 'looping_coaster',
    category: 'coaster',
    name: msg('Looping Coaster'),
    description: msg('A coaster with vertical loops'),
    buildCost: 58000,
    runningCostPerHour: 165,
    size: { width: 2, height: 1 },
    isTracked: true,
    defaultCapacity: 20,
    defaultRideTime: 90,
    excitementBase: 6.8,
    intensityBase: 6.8,
    nauseaBase: 4.2,
    minHeight: 0,
    maxHeight: 40,
  },
  stand_up_coaster: {
    type: 'stand_up_coaster',
    category: 'coaster',
    name: msg('Stand-Up Coaster'),
    description: msg('Riders stand during the ride'),
    buildCost: 62000,
    runningCostPerHour: 175,
    size: { width: 2, height: 1 },
    isTracked: true,
    defaultCapacity: 16,
    defaultRideTime: 100,
    excitementBase: 6.5,
    intensityBase: 7.2,
    nauseaBase: 5.0,
    minHeight: 0,
    maxHeight: 35,
  },
  flying_coaster: {
    type: 'flying_coaster',
    category: 'coaster',
    name: msg('Flying Coaster'),
    description: msg('Riders lie face-down like flying'),
    buildCost: 85000,
    runningCostPerHour: 220,
    size: { width: 2, height: 1 },
    isTracked: true,
    defaultCapacity: 16,
    defaultRideTime: 110,
    excitementBase: 8.0,
    intensityBase: 7.5,
    nauseaBase: 4.8,
    minHeight: 0,
    maxHeight: 45,
  },
  bobsled_coaster: {
    type: 'bobsled_coaster',
    category: 'coaster',
    name: msg('Bobsled Coaster'),
    description: msg('Sleds on a half-pipe track'),
    buildCost: 45000,
    runningCostPerHour: 140,
    size: { width: 2, height: 1 },
    isTracked: true,
    defaultCapacity: 8,
    defaultRideTime: 80,
    excitementBase: 5.0,
    intensityBase: 4.5,
    nauseaBase: 2.8,
    minHeight: 0,
    maxHeight: 25,
  },
  mine_train_coaster: {
    type: 'mine_train_coaster',
    category: 'coaster',
    name: msg('Mine Train Coaster'),
    description: msg('A themed mine train adventure'),
    buildCost: 48000,
    runningCostPerHour: 145,
    size: { width: 2, height: 1 },
    isTracked: true,
    defaultCapacity: 24,
    defaultRideTime: 150,
    excitementBase: 5.2,
    intensityBase: 4.2,
    nauseaBase: 2.2,
    minHeight: 0,
    maxHeight: 25,
  },
  hypercoaster: {
    type: 'hypercoaster',
    category: 'coaster',
    name: msg('Hypercoaster'),
    description: msg('Extremely tall and fast coaster'),
    buildCost: 100000,
    runningCostPerHour: 250,
    size: { width: 2, height: 1 },
    isTracked: true,
    defaultCapacity: 32,
    defaultRideTime: 120,
    excitementBase: 9.0,
    intensityBase: 8.5,
    nauseaBase: 3.5,
    minHeight: 0,
    maxHeight: 80,
  },
  junior_coaster: {
    type: 'junior_coaster',
    category: 'coaster',
    name: msg('Junior Coaster'),
    description: msg('A gentle coaster for younger guests'),
    buildCost: 8000,
    runningCostPerHour: 80,
    size: { width: 2, height: 1 },
    isTracked: true,
    defaultCapacity: 16,
    defaultRideTime: 90,
    excitementBase: 3.5,
    intensityBase: 2.5,
    nauseaBase: 1.2,
    minHeight: 0,
    maxHeight: 15,
  },
  spiral_coaster: {
    type: 'spiral_coaster',
    category: 'coaster',
    name: msg('Spiral Coaster'),
    description: msg('A coaster with spiral drops'),
    buildCost: 52000,
    runningCostPerHour: 155,
    size: { width: 2, height: 1 },
    isTracked: true,
    defaultCapacity: 20,
    defaultRideTime: 100,
    excitementBase: 5.6,
    intensityBase: 5.2,
    nauseaBase: 3.5,
    minHeight: 0,
    maxHeight: 35,
  },
  wild_mouse: {
    type: 'wild_mouse',
    category: 'coaster',
    name: msg('Wild Mouse'),
    description: msg('Tight turns and sudden drops'),
    buildCost: 35000,
    runningCostPerHour: 120,
    size: { width: 2, height: 1 },
    isTracked: true,
    defaultCapacity: 4,
    defaultRideTime: 80,
    excitementBase: 5.0,
    intensityBase: 5.5,
    nauseaBase: 4.0,
    minHeight: 0,
    maxHeight: 20,
  },
  multi_dimension_coaster: {
    type: 'multi_dimension_coaster',
    category: 'coaster',
    name: msg('4D Coaster'),
    description: msg('Seats rotate independently during the ride'),
    buildCost: 120000,
    runningCostPerHour: 280,
    size: { width: 2, height: 1 },
    isTracked: true,
    defaultCapacity: 16,
    defaultRideTime: 100,
    excitementBase: 9.5,
    intensityBase: 9.0,
    nauseaBase: 6.0,
    minHeight: 0,
    maxHeight: 50,
  },
};

// =============================================================================
// SHOP TYPES
// =============================================================================

export type ShopType =
  | 'burger_stall'
  | 'pizza_stall'
  | 'hot_dog_stall'
  | 'ice_cream_stall'
  | 'coffee_stall'
  | 'drink_stall'
  | 'popcorn_stall'
  | 'candy_stall'
  | 'donut_stall'
  | 'balloon_stall'
  | 'hat_stall'
  | 't_shirt_stall'
  | 'souvenir_stall'
  | 'information_kiosk'
  | 'first_aid'
  | 'restrooms'
  | 'atm';

export interface ShopDefinition {
  type: ShopType;
  name: string;
  description: string;
  buildCost: number;
  runningCostPerHour: number;
  defaultPrice: number;
  size: { width: number; height: number };
  category: 'food' | 'drink' | 'merchandise' | 'facility';
  satisfies?: 'hunger' | 'thirst' | 'bathroom' | 'cash';
}

export type ShopStatus = 'open' | 'closed';

export interface Shop {
  id: string;
  type: ShopType;
  name: string;
  x: number;
  y: number;
  status: ShopStatus;
  price: number;
  totalSales: number;
  totalRevenue: number;
  runningCostPerHour: number;
  lastVisitedAt?: number;
}

export const SHOP_DEFINITIONS: Record<ShopType, ShopDefinition> = {
  burger_stall: {
    type: 'burger_stall',
    name: msg('Burger Stall'),
    description: msg('Sells delicious burgers'),
    buildCost: 3000,
    runningCostPerHour: 30,
    defaultPrice: 5,
    size: { width: 1, height: 1 },
    category: 'food',
    satisfies: 'hunger',
  },
  pizza_stall: {
    type: 'pizza_stall',
    name: msg('Pizza Stall'),
    description: msg('Fresh pizza slices'),
    buildCost: 3500,
    runningCostPerHour: 35,
    defaultPrice: 6,
    size: { width: 1, height: 1 },
    category: 'food',
    satisfies: 'hunger',
  },
  hot_dog_stall: {
    type: 'hot_dog_stall',
    name: msg('Hot Dog Stall'),
    description: msg('Classic hot dogs'),
    buildCost: 2500,
    runningCostPerHour: 25,
    defaultPrice: 4,
    size: { width: 1, height: 1 },
    category: 'food',
    satisfies: 'hunger',
  },
  ice_cream_stall: {
    type: 'ice_cream_stall',
    name: msg('Ice Cream Stall'),
    description: msg('Cool treats for hot days'),
    buildCost: 2800,
    runningCostPerHour: 28,
    defaultPrice: 4,
    size: { width: 1, height: 1 },
    category: 'food',
    satisfies: 'hunger',
  },
  coffee_stall: {
    type: 'coffee_stall',
    name: msg('Coffee Shop'),
    description: msg('Hot coffee and pastries'),
    buildCost: 3200,
    runningCostPerHour: 32,
    defaultPrice: 5,
    size: { width: 1, height: 1 },
    category: 'drink',
    satisfies: 'thirst',
  },
  drink_stall: {
    type: 'drink_stall',
    name: msg('Drink Stall'),
    description: msg('Cold drinks and sodas'),
    buildCost: 2000,
    runningCostPerHour: 20,
    defaultPrice: 3,
    size: { width: 1, height: 1 },
    category: 'drink',
    satisfies: 'thirst',
  },
  popcorn_stall: {
    type: 'popcorn_stall',
    name: msg('Popcorn Stall'),
    description: msg('Freshly popped corn'),
    buildCost: 2200,
    runningCostPerHour: 22,
    defaultPrice: 3,
    size: { width: 1, height: 1 },
    category: 'food',
    satisfies: 'hunger',
  },
  candy_stall: {
    type: 'candy_stall',
    name: msg('Candy Stall'),
    description: msg('Sweet treats and cotton candy'),
    buildCost: 2400,
    runningCostPerHour: 24,
    defaultPrice: 4,
    size: { width: 1, height: 1 },
    category: 'food',
    satisfies: 'hunger',
  },
  donut_stall: {
    type: 'donut_stall',
    name: msg('Donut Stall'),
    description: msg('Freshly made donuts'),
    buildCost: 2600,
    runningCostPerHour: 26,
    defaultPrice: 3,
    size: { width: 1, height: 1 },
    category: 'food',
    satisfies: 'hunger',
  },
  balloon_stall: {
    type: 'balloon_stall',
    name: msg('Balloon Stall'),
    description: msg('Colorful balloons for guests'),
    buildCost: 1500,
    runningCostPerHour: 15,
    defaultPrice: 2,
    size: { width: 1, height: 1 },
    category: 'merchandise',
  },
  hat_stall: {
    type: 'hat_stall',
    name: msg('Hat Stall'),
    description: msg('Fun hats and caps'),
    buildCost: 2000,
    runningCostPerHour: 20,
    defaultPrice: 8,
    size: { width: 1, height: 1 },
    category: 'merchandise',
  },
  t_shirt_stall: {
    type: 't_shirt_stall',
    name: msg('T-Shirt Shop'),
    description: msg('Branded t-shirts and clothing'),
    buildCost: 3000,
    runningCostPerHour: 30,
    defaultPrice: 15,
    size: { width: 1, height: 1 },
    category: 'merchandise',
  },
  souvenir_stall: {
    type: 'souvenir_stall',
    name: msg('Souvenir Shop'),
    description: msg('Keepsakes and memories'),
    buildCost: 3500,
    runningCostPerHour: 35,
    defaultPrice: 10,
    size: { width: 1, height: 1 },
    category: 'merchandise',
  },
  information_kiosk: {
    type: 'information_kiosk',
    name: msg('Information Kiosk'),
    description: msg('Maps and park information'),
    buildCost: 2000,
    runningCostPerHour: 40,
    defaultPrice: 1,
    size: { width: 1, height: 1 },
    category: 'facility',
  },
  first_aid: {
    type: 'first_aid',
    name: msg('First Aid Room'),
    description: msg('Medical assistance for guests'),
    buildCost: 4000,
    runningCostPerHour: 60,
    defaultPrice: 0,
    size: { width: 1, height: 1 },
    category: 'facility',
  },
  restrooms: {
    type: 'restrooms',
    name: msg('Restrooms'),
    description: msg('Essential facilities'),
    buildCost: 5000,
    runningCostPerHour: 50,
    defaultPrice: 0,
    size: { width: 1, height: 1 },
    category: 'facility',
    satisfies: 'bathroom',
  },
  atm: {
    type: 'atm',
    name: msg('ATM'),
    description: msg('Cash withdrawal machine'),
    buildCost: 2500,
    runningCostPerHour: 10,
    defaultPrice: 0,
    size: { width: 1, height: 1 },
    category: 'facility',
    satisfies: 'cash',
  },
};

// =============================================================================
// SCENERY TYPES
// =============================================================================

export type SceneryType =
  | 'tree_oak'
  | 'tree_pine'
  | 'tree_palm'
  | 'tree_willow'
  | 'bush'
  | 'flower_bed'
  | 'bench'
  | 'trash_bin'
  | 'lamp_post'
  | 'fountain_small'
  | 'fountain_large'
  | 'statue'
  | 'fence_wood'
  | 'fence_iron'
  | 'hedge'
  | 'rock'
  | 'sign';

export interface SceneryDefinition {
  type: SceneryType;
  name: string;
  buildCost: number;
  size: { width: number; height: number };
  category: 'vegetation' | 'furniture' | 'decoration' | 'barrier';
}

export const SCENERY_DEFINITIONS: Record<SceneryType, SceneryDefinition> = {
  tree_oak: { type: 'tree_oak', name: msg('Oak Tree'), buildCost: 50, size: { width: 1, height: 1 }, category: 'vegetation' },
  tree_pine: { type: 'tree_pine', name: msg('Pine Tree'), buildCost: 50, size: { width: 1, height: 1 }, category: 'vegetation' },
  tree_palm: { type: 'tree_palm', name: msg('Palm Tree'), buildCost: 60, size: { width: 1, height: 1 }, category: 'vegetation' },
  tree_willow: { type: 'tree_willow', name: msg('Willow Tree'), buildCost: 70, size: { width: 1, height: 1 }, category: 'vegetation' },
  bush: { type: 'bush', name: msg('Bush'), buildCost: 20, size: { width: 1, height: 1 }, category: 'vegetation' },
  flower_bed: { type: 'flower_bed', name: msg('Flower Bed'), buildCost: 30, size: { width: 1, height: 1 }, category: 'vegetation' },
  bench: { type: 'bench', name: msg('Bench'), buildCost: 100, size: { width: 1, height: 1 }, category: 'furniture' },
  trash_bin: { type: 'trash_bin', name: msg('Trash Bin'), buildCost: 50, size: { width: 1, height: 1 }, category: 'furniture' },
  lamp_post: { type: 'lamp_post', name: msg('Lamp Post'), buildCost: 150, size: { width: 1, height: 1 }, category: 'furniture' },
  fountain_small: { type: 'fountain_small', name: msg('Small Fountain'), buildCost: 500, size: { width: 1, height: 1 }, category: 'decoration' },
  fountain_large: { type: 'fountain_large', name: msg('Large Fountain'), buildCost: 2000, size: { width: 2, height: 2 }, category: 'decoration' },
  statue: { type: 'statue', name: msg('Statue'), buildCost: 1000, size: { width: 1, height: 1 }, category: 'decoration' },
  fence_wood: { type: 'fence_wood', name: msg('Wooden Fence'), buildCost: 30, size: { width: 1, height: 1 }, category: 'barrier' },
  fence_iron: { type: 'fence_iron', name: msg('Iron Fence'), buildCost: 50, size: { width: 1, height: 1 }, category: 'barrier' },
  hedge: { type: 'hedge', name: msg('Hedge'), buildCost: 40, size: { width: 1, height: 1 }, category: 'barrier' },
  rock: { type: 'rock', name: msg('Rock'), buildCost: 25, size: { width: 1, height: 1 }, category: 'decoration' },
  sign: { type: 'sign', name: msg('Sign'), buildCost: 100, size: { width: 1, height: 1 }, category: 'decoration' },
};

// =============================================================================
// BUILDING UNION TYPE
// =============================================================================

export type ParkBuildingType = RideType | ShopType | SceneryType | 'park_entrance' | 'queue_path' | 'path';

export interface ParkBuilding {
  type: ParkBuildingType;
  rideId?: string; // Reference to ride if this is a ride tile
  shopId?: string; // Reference to shop if this is a shop tile
  orientation?: number; // 0, 90, 180, 270 degrees
  variant?: number; // For visual variants
}
