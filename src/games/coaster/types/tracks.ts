/**
 * Coaster Track Types
 * Defines track pieces, coaster types, and coaster car systems
 */

// =============================================================================
// TRACK PIECE TYPES
// =============================================================================

/** Height levels for track pieces (0 = ground, higher = elevated) */
export type TrackHeight = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/** Direction the track faces on the grid */
export type TrackDirection = 'north' | 'east' | 'south' | 'west';

/** Types of track pieces that can be placed */
export type TrackPieceType =
  // Flat pieces
  | 'straight_flat'
  | 'turn_left_flat'
  | 'turn_right_flat'
  | 'turn_left_large_flat'
  | 'turn_right_large_flat'
  
  // Slopes (height changes)
  | 'slope_up_small'      // +1 height
  | 'slope_up_medium'     // +2 height
  | 'slope_up_steep'      // +3 height
  | 'slope_down_small'    // -1 height
  | 'slope_down_medium'   // -2 height
  | 'slope_down_steep'    // -3 height
  
  // Lift hill (chain lift)
  | 'lift_hill_start'
  | 'lift_hill_middle'
  | 'lift_hill_end'
  
  // Drops
  | 'drop_small'
  | 'drop_medium'
  | 'drop_large'
  | 'drop_vertical'
  | 'drop_beyond_vertical' // 100+ degrees
  
  // Inversions
  | 'loop_vertical'
  | 'loop_small'
  | 'loop_large'
  | 'corkscrew_left'
  | 'corkscrew_right'
  | 'barrel_roll_left'
  | 'barrel_roll_right'
  | 'zero_g_roll'
  | 'cobra_roll'
  | 'immelmann'
  | 'dive_loop'
  | 'heartline_roll'
  
  // Helixes
  | 'helix_up_left'
  | 'helix_up_right'
  | 'helix_down_left'
  | 'helix_down_right'
  | 'helix_large_up_left'
  | 'helix_large_up_right'
  | 'helix_large_down_left'
  | 'helix_large_down_right'
  
  // Banked turns
  | 'turn_banked_left'
  | 'turn_banked_right'
  | 'turn_banked_left_large'
  | 'turn_banked_right_large'
  
  // Special elements
  | 'brakes'
  | 'block_brakes'
  | 'booster'
  | 'station'
  | 's_bend_left'
  | 's_bend_right';

/** Bank angle for turns */
export type BankAngle = 0 | 15 | 30 | 45 | 60 | 90;

// =============================================================================
// TRACK PIECE INTERFACE
// =============================================================================

export interface TrackPiece {
  type: TrackPieceType;
  direction: TrackDirection;
  startHeight: TrackHeight;
  endHeight: TrackHeight;
  bankAngle: BankAngle;
  chainLift: boolean; // Has chain lift (for lift hills)
  boosted: boolean; // Has launch boost
}

// =============================================================================
// COASTER TYPE DEFINITIONS
// =============================================================================

export type CoasterType =
  | 'wooden_classic'
  | 'wooden_twister'
  | 'steel_standup'
  | 'steel_sit_down'
  | 'steel_inverted'
  | 'steel_floorless'
  | 'steel_wing'
  | 'steel_flying'
  | 'steel_4d'
  | 'steel_spinning'
  | 'mine_train'
  | 'bobsled'
  | 'suspended'
  | 'water_coaster'
  | 'launch_coaster'
  | 'hyper_coaster'
  | 'giga_coaster';

export interface CoasterTypeStats {
  name: string;
  maxSpeed: number; // km/h
  maxHeight: TrackHeight;
  canInvert: boolean;
  canBank: boolean;
  trainLength: { min: number; max: number }; // cars per train
  trainsPerTrack: { min: number; max: number };
  excitement: { base: number; perInversion: number; perDrop: number };
  intensity: { base: number; perInversion: number; perDrop: number };
  nausea: { base: number; perInversion: number; perDrop: number };
  baseCost: number; // Per track piece
  upkeep: number; // Per month
}

export const COASTER_TYPE_STATS: Record<CoasterType, CoasterTypeStats> = {
  wooden_classic: {
    name: 'Classic Wooden Coaster',
    maxSpeed: 100,
    maxHeight: 8,
    canInvert: false,
    canBank: true,
    trainLength: { min: 4, max: 8 },
    trainsPerTrack: { min: 1, max: 3 },
    excitement: { base: 5, perInversion: 0, perDrop: 0.3 },
    intensity: { base: 4, perInversion: 0, perDrop: 0.4 },
    nausea: { base: 3, perInversion: 0, perDrop: 0.2 },
    baseCost: 50,
    upkeep: 100,
  },
  wooden_twister: {
    name: 'Wooden Twister',
    maxSpeed: 110,
    maxHeight: 9,
    canInvert: false,
    canBank: true,
    trainLength: { min: 4, max: 10 },
    trainsPerTrack: { min: 1, max: 3 },
    excitement: { base: 6, perInversion: 0, perDrop: 0.35 },
    intensity: { base: 5, perInversion: 0, perDrop: 0.45 },
    nausea: { base: 3, perInversion: 0, perDrop: 0.25 },
    baseCost: 60,
    upkeep: 120,
  },
  steel_sit_down: {
    name: 'Steel Sit-Down',
    maxSpeed: 130,
    maxHeight: 10,
    canInvert: true,
    canBank: true,
    trainLength: { min: 3, max: 8 },
    trainsPerTrack: { min: 1, max: 4 },
    excitement: { base: 6, perInversion: 0.5, perDrop: 0.4 },
    intensity: { base: 5, perInversion: 0.6, perDrop: 0.5 },
    nausea: { base: 2, perInversion: 0.4, perDrop: 0.3 },
    baseCost: 80,
    upkeep: 150,
  },
  steel_inverted: {
    name: 'Inverted Coaster',
    maxSpeed: 120,
    maxHeight: 9,
    canInvert: true,
    canBank: true,
    trainLength: { min: 4, max: 8 },
    trainsPerTrack: { min: 1, max: 3 },
    excitement: { base: 7, perInversion: 0.6, perDrop: 0.5 },
    intensity: { base: 6, perInversion: 0.7, perDrop: 0.6 },
    nausea: { base: 3, perInversion: 0.5, perDrop: 0.4 },
    baseCost: 100,
    upkeep: 180,
  },
  steel_standup: {
    name: 'Stand-Up Coaster',
    maxSpeed: 100,
    maxHeight: 8,
    canInvert: true,
    canBank: true,
    trainLength: { min: 4, max: 6 },
    trainsPerTrack: { min: 1, max: 2 },
    excitement: { base: 6, perInversion: 0.5, perDrop: 0.4 },
    intensity: { base: 6, perInversion: 0.7, perDrop: 0.5 },
    nausea: { base: 4, perInversion: 0.6, perDrop: 0.4 },
    baseCost: 90,
    upkeep: 160,
  },
  steel_floorless: {
    name: 'Floorless Coaster',
    maxSpeed: 125,
    maxHeight: 10,
    canInvert: true,
    canBank: true,
    trainLength: { min: 4, max: 8 },
    trainsPerTrack: { min: 1, max: 3 },
    excitement: { base: 7, perInversion: 0.6, perDrop: 0.5 },
    intensity: { base: 6, perInversion: 0.7, perDrop: 0.55 },
    nausea: { base: 3, perInversion: 0.5, perDrop: 0.35 },
    baseCost: 110,
    upkeep: 190,
  },
  steel_wing: {
    name: 'Wing Coaster',
    maxSpeed: 115,
    maxHeight: 9,
    canInvert: true,
    canBank: true,
    trainLength: { min: 4, max: 7 },
    trainsPerTrack: { min: 1, max: 3 },
    excitement: { base: 8, perInversion: 0.7, perDrop: 0.6 },
    intensity: { base: 6, perInversion: 0.6, perDrop: 0.5 },
    nausea: { base: 3, perInversion: 0.4, perDrop: 0.3 },
    baseCost: 130,
    upkeep: 220,
  },
  steel_flying: {
    name: 'Flying Coaster',
    maxSpeed: 100,
    maxHeight: 8,
    canInvert: true,
    canBank: true,
    trainLength: { min: 4, max: 8 },
    trainsPerTrack: { min: 1, max: 2 },
    excitement: { base: 8, perInversion: 0.8, perDrop: 0.6 },
    intensity: { base: 7, perInversion: 0.8, perDrop: 0.6 },
    nausea: { base: 4, perInversion: 0.6, perDrop: 0.5 },
    baseCost: 140,
    upkeep: 250,
  },
  steel_4d: {
    name: '4D Coaster',
    maxSpeed: 90,
    maxHeight: 7,
    canInvert: true,
    canBank: true,
    trainLength: { min: 2, max: 4 },
    trainsPerTrack: { min: 1, max: 2 },
    excitement: { base: 9, perInversion: 0.9, perDrop: 0.7 },
    intensity: { base: 8, perInversion: 0.9, perDrop: 0.7 },
    nausea: { base: 5, perInversion: 0.7, perDrop: 0.6 },
    baseCost: 200,
    upkeep: 350,
  },
  steel_spinning: {
    name: 'Spinning Coaster',
    maxSpeed: 70,
    maxHeight: 6,
    canInvert: false,
    canBank: true,
    trainLength: { min: 4, max: 8 },
    trainsPerTrack: { min: 1, max: 3 },
    excitement: { base: 6, perInversion: 0, perDrop: 0.4 },
    intensity: { base: 5, perInversion: 0, perDrop: 0.4 },
    nausea: { base: 5, perInversion: 0, perDrop: 0.5 },
    baseCost: 70,
    upkeep: 130,
  },
  mine_train: {
    name: 'Mine Train',
    maxSpeed: 80,
    maxHeight: 6,
    canInvert: false,
    canBank: true,
    trainLength: { min: 5, max: 10 },
    trainsPerTrack: { min: 1, max: 4 },
    excitement: { base: 5, perInversion: 0, perDrop: 0.3 },
    intensity: { base: 4, perInversion: 0, perDrop: 0.3 },
    nausea: { base: 2, perInversion: 0, perDrop: 0.2 },
    baseCost: 55,
    upkeep: 90,
  },
  bobsled: {
    name: 'Bobsled Coaster',
    maxSpeed: 85,
    maxHeight: 7,
    canInvert: false,
    canBank: true,
    trainLength: { min: 2, max: 4 },
    trainsPerTrack: { min: 1, max: 4 },
    excitement: { base: 5, perInversion: 0, perDrop: 0.35 },
    intensity: { base: 5, perInversion: 0, perDrop: 0.4 },
    nausea: { base: 3, perInversion: 0, perDrop: 0.3 },
    baseCost: 60,
    upkeep: 100,
  },
  suspended: {
    name: 'Suspended Swinging',
    maxSpeed: 90,
    maxHeight: 8,
    canInvert: false,
    canBank: true,
    trainLength: { min: 4, max: 8 },
    trainsPerTrack: { min: 1, max: 3 },
    excitement: { base: 6, perInversion: 0, perDrop: 0.4 },
    intensity: { base: 5, perInversion: 0, perDrop: 0.45 },
    nausea: { base: 4, perInversion: 0, perDrop: 0.4 },
    baseCost: 85,
    upkeep: 140,
  },
  water_coaster: {
    name: 'Water Coaster',
    maxSpeed: 75,
    maxHeight: 7,
    canInvert: false,
    canBank: true,
    trainLength: { min: 4, max: 8 },
    trainsPerTrack: { min: 1, max: 3 },
    excitement: { base: 6, perInversion: 0, perDrop: 0.5 },
    intensity: { base: 5, perInversion: 0, perDrop: 0.4 },
    nausea: { base: 2, perInversion: 0, perDrop: 0.2 },
    baseCost: 100,
    upkeep: 170,
  },
  launch_coaster: {
    name: 'Launch Coaster',
    maxSpeed: 150,
    maxHeight: 10,
    canInvert: true,
    canBank: true,
    trainLength: { min: 3, max: 6 },
    trainsPerTrack: { min: 1, max: 2 },
    excitement: { base: 8, perInversion: 0.7, perDrop: 0.6 },
    intensity: { base: 7, perInversion: 0.8, perDrop: 0.7 },
    nausea: { base: 3, perInversion: 0.5, perDrop: 0.4 },
    baseCost: 150,
    upkeep: 280,
  },
  hyper_coaster: {
    name: 'Hyper Coaster',
    maxSpeed: 140,
    maxHeight: 10,
    canInvert: false,
    canBank: true,
    trainLength: { min: 6, max: 12 },
    trainsPerTrack: { min: 1, max: 4 },
    excitement: { base: 8, perInversion: 0, perDrop: 0.7 },
    intensity: { base: 7, perInversion: 0, perDrop: 0.65 },
    nausea: { base: 2, perInversion: 0, perDrop: 0.3 },
    baseCost: 120,
    upkeep: 200,
  },
  giga_coaster: {
    name: 'Giga Coaster',
    maxSpeed: 160,
    maxHeight: 10,
    canInvert: false,
    canBank: true,
    trainLength: { min: 6, max: 14 },
    trainsPerTrack: { min: 1, max: 4 },
    excitement: { base: 9, perInversion: 0, perDrop: 0.8 },
    intensity: { base: 8, perInversion: 0, perDrop: 0.75 },
    nausea: { base: 2, perInversion: 0, perDrop: 0.35 },
    baseCost: 180,
    upkeep: 320,
  },
};

// =============================================================================
// COASTER INTERFACE (Complete coaster with track)
// =============================================================================

export interface Coaster {
  id: string;
  name: string;
  type: CoasterType;
  color: { primary: string; secondary: string; supports: string };
  track: TrackPiece[];
  trackTiles: { x: number; y: number }[];
  stationTileX: number;
  stationTileY: number;
  trains: CoasterTrain[];
  operating: boolean;
  broken: boolean;
  excitement: number;
  intensity: number;
  nausea: number;
  ridersTotal: number;
  income: number;
  upkeep: number;
}

// =============================================================================
// COASTER TRAIN & CAR
// =============================================================================

export interface CoasterCar {
  /** Progress along the entire track (0 to track.length) */
  trackProgress: number;
  /** Current velocity in units per second */
  velocity: number;
  /** Current rotation (for inversions, banks) */
  rotation: { pitch: number; yaw: number; roll: number };
  /** Screen position (calculated from track position) */
  screenX: number;
  screenY: number;
  screenZ: number; // Height for draw ordering
  /** Guests in this car */
  guests: string[]; // Guest IDs
}

export interface CoasterTrain {
  id: string;
  cars: CoasterCar[];
  /** Current state */
  state: 'loading' | 'dispatching' | 'running' | 'braking' | 'returning';
  /** Time until next state change */
  stateTimer: number;
}
