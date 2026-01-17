/**
 * Coaster Tycoon Ride Types
 * Defines track pieces, ride instances, and ride mechanics
 */

import { RideType, CoasterType, RideCategory, RIDE_DEFINITIONS } from './buildings';

// =============================================================================
// TRACK PIECE TYPES
// =============================================================================

export type TrackPieceType =
  // Flat pieces
  | 'flat_straight'
  | 'flat_turn_left'
  | 'flat_turn_right'
  | 'flat_s_bend_left'
  | 'flat_s_bend_right'
  
  // Slopes
  | 'slope_up_25'
  | 'slope_up_60'
  | 'slope_up_90'
  | 'slope_down_25'
  | 'slope_down_60'
  | 'slope_down_90'
  
  // Slope transitions
  | 'flat_to_slope_up_25'
  | 'slope_up_25_to_flat'
  | 'slope_up_25_to_60'
  | 'slope_up_60_to_25'
  | 'flat_to_slope_down_25'
  | 'slope_down_25_to_flat'
  
  // Banked turns
  | 'banked_turn_left'
  | 'banked_turn_right'
  | 'banked_helix_left_small'
  | 'banked_helix_right_small'
  | 'banked_helix_left_large'
  | 'banked_helix_right_large'
  
  // Special elements
  | 'chain_lift'
  | 'station'
  | 'block_brakes'
  | 'brakes'
  | 'on_ride_photo'
  | 'booster'
  
  // Inversions
  | 'vertical_loop'
  | 'corkscrew_left'
  | 'corkscrew_right'
  | 'barrel_roll_left'
  | 'barrel_roll_right'
  | 'half_loop_up'
  | 'half_loop_down'
  | 'cobra_roll'
  | 'heartline_roll'
  | 'zero_g_roll'
  | 'inline_twist'
  
  // Drops
  | 'vertical_drop'
  | 'beyond_vertical_drop'
  | 'dive_loop'
  | 'immelmann';

// =============================================================================
// TRACK ELEMENT
// =============================================================================

export interface TrackElement {
  type: TrackPieceType;
  
  // Position in grid
  x: number;
  y: number;
  height: number;        // Height level (0-255, each unit = ~1m)
  
  // Orientation
  direction: 0 | 1 | 2 | 3;  // N, E, S, W (multiplied by 90 degrees)
  
  // Physics
  chainSpeed?: number;   // For chain lifts
  brakeSpeed?: number;   // For brakes
  boostSpeed?: number;   // For boosters
  
  // Flags
  isStation?: boolean;
  stationIndex?: number; // For multi-station rides
}

// =============================================================================
// RIDE STATS (Calculated from layout)
// =============================================================================

export interface RideStats {
  // Main ratings (0.00 - 10.00+, displayed to 2 decimals)
  excitement: number;
  intensity: number;
  nausea: number;
  
  // Physical measurements
  maxSpeed: number;           // km/h
  averageSpeed: number;       // km/h
  rideTime: number;           // seconds
  rideLength: number;         // meters
  maxPositiveGs: number;
  maxNegativeGs: number;
  maxLateralGs: number;
  
  // Element counts
  totalAirTime: number;       // seconds
  drops: number;
  highestDropHeight: number;  // meters
  inversions: number;
  
  // Breakdown stats
  reliability: number;        // 0-100%
  breakdownRate: number;      // Average hours between breakdowns
}

// =============================================================================
// COASTER TRAIN
// =============================================================================

export interface CoasterCar {
  // Position along track (0.0 - trackLength)
  trackPosition: number;
  
  // Calculated world position (for rendering)
  worldX: number;
  worldY: number;
  worldZ: number;
  
  // Rotation
  pitch: number;    // Forward/back tilt
  yaw: number;      // Left/right direction
  roll: number;     // Banking/inversion
  
  // Physics
  velocity: number; // Current speed in m/s
}

export interface CoasterTrain {
  id: number;
  cars: CoasterCar[];
  
  // Status
  status: 'in_station' | 'loading' | 'departing' | 'running' | 'approaching' | 'braking' | 'broken';
  currentStation: number;
  
  // Guests on this train
  guestIds: number[];
  
  // Timing
  departureTimer: number;  // Countdown to departure
}

// =============================================================================
// RIDE INSTANCE
// =============================================================================

export type RideStatus = 
  | 'building'     // Under construction
  | 'testing'      // Test runs
  | 'open'         // Open to guests
  | 'closed'       // Closed but operational
  | 'broken'       // Broken down
  | 'maintenance'; // Being inspected/repaired

export interface Ride {
  id: string;
  type: RideType;
  name: string;
  customName: boolean;  // Has player renamed it?
  
  // Location
  entranceX: number;
  entranceY: number;
  exitX: number;
  exitY: number;
  
  // Track (for tracked rides)
  track: TrackElement[];
  
  // Flat ride footprint (for non-tracked rides)
  tiles: { x: number; y: number }[];
  
  // Status
  status: RideStatus;
  operatingMode: 'normal' | 'continuous_circuit' | 'shuttle' | 'race';
  
  // Trains (for tracked rides)
  trains: CoasterTrain[];
  numTrains: number;
  carsPerTrain: number;
  
  // Queue
  queuePath: { x: number; y: number }[];
  queueLength: number;          // Current queue length (guests)
  maxQueueLength: number;       // Max capacity
  guestsInQueue: number[];      // Guest IDs in queue
  
  // Guests currently on ride
  guestsOnRide: number[];

  // Ride cycle state
  cycleTimer: number;            // Ticks remaining in current cycle
  isRunning: boolean;
  
  // Stats (calculated from track/type)
  stats: RideStats;
  
  // Operations
  price: number;                // Ticket price
  minWaitTime: number;          // Seconds between dispatches
  maxWaitTime: number;
  inspectionInterval: number;   // Minutes between inspections
  lastInspection: number;       // Timestamp
  
  // Financials
  totalRiders: number;
  totalRevenue: number;
  buildCost: number;
  age: number;                  // Months since opening
  
  // Reliability
  reliability: number;          // 0-100
  downtime: number;             // Total downtime in hours
  breakdowns: number;           // Total breakdowns
  
  // Music/theme
  musicType?: string;
  lightingMode?: 'on' | 'off' | 'automatic';
}

// =============================================================================
// RIDE CALCULATION HELPERS
// =============================================================================

/**
 * Calculate base excitement from track elements
 */
export function calculateTrackExcitement(track: TrackElement[], rideType: CoasterType): number {
  const def = RIDE_DEFINITIONS[rideType];
  let excitement = def.excitementBase;
  
  // Bonus for length
  excitement += Math.min(track.length * 0.02, 2.0);
  
  // Bonus for drops
  const drops = track.filter(t => 
    t.type.includes('slope_down') || 
    t.type.includes('vertical_drop')
  ).length;
  excitement += Math.min(drops * 0.15, 1.5);
  
  // Bonus for inversions
  const inversions = track.filter(t =>
    t.type.includes('loop') ||
    t.type.includes('corkscrew') ||
    t.type.includes('roll') ||
    t.type.includes('twist')
  ).length;
  excitement += Math.min(inversions * 0.2, 2.0);
  
  // Bonus for height variation
  const heights = track.map(t => t.height);
  const maxHeight = Math.max(...heights);
  const minHeight = Math.min(...heights);
  excitement += Math.min((maxHeight - minHeight) * 0.03, 1.5);
  
  return Math.round(excitement * 100) / 100;
}

/**
 * Calculate base intensity from track elements
 */
export function calculateTrackIntensity(track: TrackElement[], rideType: CoasterType): number {
  const def = RIDE_DEFINITIONS[rideType];
  let intensity = def.intensityBase;
  
  // Steep slopes increase intensity
  const steepElements = track.filter(t =>
    t.type.includes('60') ||
    t.type.includes('90') ||
    t.type.includes('vertical')
  ).length;
  intensity += steepElements * 0.1;
  
  // Inversions increase intensity
  const inversions = track.filter(t =>
    t.type.includes('loop') ||
    t.type.includes('corkscrew') ||
    t.type.includes('roll')
  ).length;
  intensity += inversions * 0.25;
  
  // Chain lifts add suspense
  const chainLifts = track.filter(t => t.type === 'chain_lift').length;
  intensity += chainLifts * 0.1;
  
  return Math.round(intensity * 100) / 100;
}

/**
 * Calculate base nausea from track elements
 */
export function calculateTrackNausea(track: TrackElement[], rideType: CoasterType): number {
  const def = RIDE_DEFINITIONS[rideType];
  let nausea = def.nauseaBase;
  
  // Inversions increase nausea
  const inversions = track.filter(t =>
    t.type.includes('loop') ||
    t.type.includes('corkscrew') ||
    t.type.includes('roll') ||
    t.type.includes('twist')
  ).length;
  nausea += inversions * 0.3;
  
  // Helixes increase nausea
  const helixes = track.filter(t => t.type.includes('helix')).length;
  nausea += helixes * 0.25;
  
  // Multiple inversions in sequence is worse
  if (inversions >= 5) {
    nausea += 0.5;
  }
  
  return Math.round(nausea * 100) / 100;
}

/**
 * Get ride category from type
 */
export function getRideCategory(rideType: RideType): RideCategory {
  const def = RIDE_DEFINITIONS[rideType];
  return def.category;
}

/**
 * Check if a ride type uses a track
 */
export function isTrackedRide(rideType: RideType): boolean {
  const def = RIDE_DEFINITIONS[rideType];
  return def.isTracked;
}

/**
 * Calculate ride reliability over time
 */
export function calculateReliability(age: number, breakdowns: number, inspections: number): number {
  // Base reliability decreases with age
  let reliability = 100 - (age * 0.5);
  
  // Each breakdown reduces reliability
  reliability -= breakdowns * 2;
  
  // Recent inspections improve reliability
  reliability += Math.min(inspections * 0.5, 10);
  
  return Math.max(0, Math.min(100, reliability));
}

/**
 * Create empty ride stats
 */
export function createEmptyStats(): RideStats {
  return {
    excitement: 0,
    intensity: 0,
    nausea: 0,
    maxSpeed: 0,
    averageSpeed: 0,
    rideTime: 0,
    rideLength: 0,
    maxPositiveGs: 0,
    maxNegativeGs: 0,
    maxLateralGs: 0,
    totalAirTime: 0,
    drops: 0,
    highestDropHeight: 0,
    inversions: 0,
    reliability: 100,
    breakdownRate: 168, // Weekly default
  };
}

/**
 * Generate a unique ride ID
 */
export function generateRideId(): string {
  return `ride_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate a default ride name
 */
const COASTER_NAME_ADJECTIVES = [
  'Wild', 'Thunder', 'Steel', 'Screaming', 'Twisted', 'Flying',
  'Raging', 'Midnight', 'Crimson', 'Golden', 'Silver', 'Iron',
  'Electric', 'Cosmic', 'Phantom', 'Shadow', 'Blazing', 'Frozen',
];

const COASTER_NAME_NOUNS = [
  'Fury', 'Express', 'Dragon', 'Lightning', 'Viper', 'Falcon',
  'Tornado', 'Cyclone', 'Phoenix', 'Thunder', 'Storm', 'Blaze',
  'Comet', 'Rocket', 'Bullet', 'Arrow', 'Serpent', 'Eagle',
];

export function generateRideName(rideType: RideType): string {
  const def = RIDE_DEFINITIONS[rideType];
  
  if (def.category === 'coaster') {
    const adj = COASTER_NAME_ADJECTIVES[Math.floor(Math.random() * COASTER_NAME_ADJECTIVES.length)];
    const noun = COASTER_NAME_NOUNS[Math.floor(Math.random() * COASTER_NAME_NOUNS.length)];
    return `${adj} ${noun}`;
  }
  
  // For non-coasters, just use the default name with a number
  return `${def.name} 1`;
}
