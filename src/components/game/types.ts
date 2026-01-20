// Game-specific types for rendering and animation

import { CardinalDirection } from '@/core/types';

// Isometric tile dimensions
export const TILE_WIDTH = 64;
export const HEIGHT_RATIO = 0.60;
export const TILE_HEIGHT = TILE_WIDTH * HEIGHT_RATIO;
export const KEY_PAN_SPEED = 520;

// Car/Vehicle types - alias CardinalDirection for backward compatibility
export type CarDirection = CardinalDirection;

export type Car = {
  id: number;
  tileX: number;
  tileY: number;
  direction: CarDirection;
  progress: number;
  speed: number;
  age: number;
  maxAge: number;
  color: string;
  laneOffset: number;
};

export type Bus = {
  id: number;
  tileX: number;
  tileY: number;
  direction: CarDirection;
  progress: number;
  speed: number;
  age: number;
  maxAge: number;
  color: string;
  laneOffset: number;
  path: { x: number; y: number }[];
  pathIndex: number;
  stopTimer: number;
  stops: { x: number; y: number }[];
};

// Airplane types for airport animation
export type AirplaneState = 'flying' | 'landing' | 'taking_off' | 'taxiing';

// Plane model types from the sprite sheet
export type PlaneType = '737' | '777' | '747' | 'a380' | 'g650' | 'seaplane';

export type ContrailParticle = {
  x: number;
  y: number;
  age: number;
  opacity: number;
};

export type Airplane = {
  id: number;
  // Screen position (isometric coordinates)
  x: number;
  y: number;
  // Flight direction in radians
  angle: number;
  // Current state
  state: AirplaneState;
  // Speed (pixels per second in screen space)
  speed: number;
  // Altitude (0 = ground, 1 = cruising altitude) - affects scale and shadow
  altitude: number;
  // Target altitude for transitions
  targetAltitude: number;
  // Airport tile coordinates (for landing/takeoff reference)
  airportX: number;
  airportY: number;
  // Progress for landing/takeoff (0-1)
  stateProgress: number;
  // Contrail particles
  contrail: ContrailParticle[];
  // Time until despawn (for flying planes)
  lifeTime: number;
  // Plane color/style (legacy, for fallback rendering)
  color: string;
  // Plane model type from sprite sheet
  planeType: PlaneType;
};

// Seaplane types for bay/water operations
export type SeaplaneState = 'taxiing_water' | 'taxiing_to_dock' | 'docked' | 'taking_off' | 'flying' | 'landing' | 'splashdown';

export type Seaplane = {
  id: number;
  // Screen position (isometric coordinates)
  x: number;
  y: number;
  // Flight/movement direction in radians
  angle: number;
  // Target angle for smooth turning (on water)
  targetAngle: number;
  // Current state
  state: SeaplaneState;
  // Speed (pixels per second in screen space)
  speed: number;
  // Altitude (0 = on water, 1 = cruising altitude)
  altitude: number;
  // Target altitude for transitions
  targetAltitude: number;
  // Bay tile coordinates (home bay for landing reference)
  bayTileX: number;
  bayTileY: number;
  // Bay screen position (center of bay)
  bayScreenX: number;
  bayScreenY: number;
  // Progress for state transitions
  stateProgress: number;
  // Contrail particles (when flying at altitude)
  contrail: ContrailParticle[];
  // Wake particles (when on water)
  wake: WakeParticle[];
  // Wake spawn progress
  wakeSpawnProgress: number;
  // Time until state change
  lifeTime: number;
  // Time spent taxiing on water before takeoff
  taxiTime: number;
  // Seaplane color/style
  color: string;
  // Dock target (marina/pier) - null if no dock in bay
  dockTileX: number | null;
  dockTileY: number | null;
  dockScreenX: number | null;
  dockScreenY: number | null;
  // Time spent docked
  dockTime: number;
  // Number of flights completed (for cycle tracking)
  flightCount: number;
};

// Helicopter types for hospital/airport transport
export type HelicopterState = 'flying' | 'hovering' | 'landing' | 'taking_off';

export type RotorWashParticle = {
  x: number;
  y: number;
  age: number;
  opacity: number;
};

export type Helicopter = {
  id: number;
  // Screen position (isometric coordinates)
  x: number;
  y: number;
  // Flight direction in radians
  angle: number;
  // Current state
  state: HelicopterState;
  // Speed (pixels per second in screen space)
  speed: number;
  // Altitude (0 = ground, 0.5 = cruising for helicopters)
  altitude: number;
  // Target altitude for transitions
  targetAltitude: number;
  // Origin heliport (hospital, airport, police, or mall) tile coordinates
  originX: number;
  originY: number;
  originType: 'hospital' | 'airport' | 'police' | 'mall';
  // Destination heliport tile coordinates
  destX: number;
  destY: number;
  destType: 'hospital' | 'airport' | 'police' | 'mall';
  // Destination screen position
  destScreenX: number;
  destScreenY: number;
  // Progress for state transitions
  stateProgress: number;
  // Rotor wash/exhaust particles (small contrails)
  rotorWash: RotorWashParticle[];
  // Rotor animation angle
  rotorAngle: number;
  // Helicopter color/style
  color: string;
  // Searchlight properties (active at night)
  searchlightAngle: number; // Current angle of the searchlight sweep (radians)
  searchlightSweepSpeed: number; // How fast the light sweeps (radians per second)
  searchlightSweepRange: number; // Max angle deviation from center (radians)
  searchlightBaseAngle: number; // Base direction of the searchlight sweep
};

// Emergency vehicle types
export type EmergencyVehicleType = 'fire_truck' | 'police_car';
export type EmergencyVehicleState = 'dispatching' | 'responding' | 'returning';

export type EmergencyVehicle = {
  id: number;
  type: EmergencyVehicleType;
  tileX: number;
  tileY: number;
  direction: CarDirection;
  progress: number;
  speed: number;
  state: EmergencyVehicleState;
  stationX: number;
  stationY: number;
  targetX: number;
  targetY: number;
  path: { x: number; y: number }[];
  pathIndex: number;
  respondTime: number; // Time spent at the scene
  laneOffset: number;
  flashTimer: number; // For emergency light animation
};

// Pedestrian types, destinations, and behaviors
export type PedestrianDestType = 'school' | 'commercial' | 'industrial' | 'park' | 'beach' | 'home';

// Pedestrian behavioral states
export type PedestrianState =
  | 'walking'           // Walking along a path
  | 'approaching_shop'  // Walking up to a shop entrance (visible at door)
  | 'entering_building' // Entering a building (walking through door)
  | 'inside_building'   // Inside a building (invisible)
  | 'exiting_building'  // Exiting a building (walking out of door)
  | 'at_recreation'     // At a recreational area doing an activity
  | 'at_beach'          // At the beach (swimming or on mat)
  | 'idle'              // Standing still, waiting
  | 'socializing';      // Chatting with other pedestrians

// Activities pedestrians can do at recreation areas
export type PedestrianActivity =
  | 'none'
  | 'playing_basketball'
  | 'playing_tennis'
  | 'playing_soccer'
  | 'playing_baseball'
  | 'swimming'
  | 'beach_swimming'
  | 'lying_on_mat'
  | 'skateboarding'
  | 'sitting_bench'
  | 'picnicking'
  | 'walking_dog'
  | 'jogging'
  | 'playground'
  | 'watching_game'
  | 'shopping'
  | 'working'
  | 'studying';

// Recreation area types with their associated activities
export type RecreationAreaType =
  | 'basketball_court'
  | 'tennis_court'
  | 'soccer_field'
  | 'baseball_field'
  | 'swimming_pool'
  | 'skate_park'
  | 'park_bench'
  | 'playground'
  | 'stadium_seating'
  | 'generic_park';

export type Pedestrian = {
  id: number;
  tileX: number;
  tileY: number;
  direction: CarDirection;
  progress: number;
  speed: number;
  age: number;
  maxAge: number;
  skinColor: string;
  shirtColor: string;
  pantsColor: string;        // NEW: pants/shorts color
  hasHat: boolean;           // NEW: wearing a hat
  hatColor: string;          // NEW: hat color
  walkOffset: number;        // For walking animation
  sidewalkSide: 'left' | 'right';
  destType: PedestrianDestType;
  homeX: number;
  homeY: number;
  destX: number;
  destY: number;
  returningHome: boolean;
  path: { x: number; y: number }[];
  pathIndex: number;
  // NEW: Dynamic behavior properties
  state: PedestrianState;
  activity: PedestrianActivity;
  activityProgress: number;  // 0-1 progress through current activity
  activityDuration: number;  // How long to stay at current activity (seconds)
  buildingEntryProgress: number; // 0-1 for enter/exit animations
  socialTarget: number | null;   // ID of pedestrian we're socializing with
  // Position offset within activity area (for varied positioning)
  activityOffsetX: number;
  activityOffsetY: number;
  // Animation state for activities
  activityAnimTimer: number;
  // Items the pedestrian might have
  hasBall: boolean;          // Carrying a ball
  hasDog: boolean;           // Walking a dog
  hasBag: boolean;           // Shopping bag or briefcase
  // Beach-specific properties
  hasBeachMat: boolean;      // Has a beach mat
  matColor: string;          // Color of the beach mat
  beachTileX: number;        // Beach water tile X (for swimming position)
  beachTileY: number;        // Beach water tile Y (for swimming position)
  beachEdge: 'north' | 'east' | 'south' | 'west' | null; // Which edge of water tile is beach
};

// Boat types for water navigation
export type BoatState = 'sailing' | 'docked' | 'arriving' | 'departing' | 'touring';

export type WakeParticle = {
  x: number;
  y: number;
  age: number;
  opacity: number;
};

export type TourWaypoint = {
  screenX: number;
  screenY: number;
  tileX: number;
  tileY: number;
};

export type Boat = {
  id: number;
  // Screen position (isometric coordinates)
  x: number;
  y: number;
  // Movement direction in radians
  angle: number;
  // Target angle for smooth turning
  targetAngle: number;
  // Current state
  state: BoatState;
  // Speed (pixels per second in screen space)
  speed: number;
  // Origin marina/pier tile coordinates (home dock)
  originX: number;
  originY: number;
  // Destination marina/pier tile coordinates
  destX: number;
  destY: number;
  // Screen position of destination
  destScreenX: number;
  destScreenY: number;
  // Lifetime/age tracking
  age: number;
  // Boat color/style
  color: string;
  // Wake particles (similar to plane contrails)
  wake: WakeParticle[];
  // Progress for wake spawning
  wakeSpawnProgress: number;
  // Boat size variant (0 = small, 1 = medium)
  sizeVariant: number;
  // Tour waypoints - points to visit during tour before returning to dock
  tourWaypoints: TourWaypoint[];
  // Current waypoint index in tour
  tourWaypointIndex: number;
  // Home dock screen position (for return trip)
  homeScreenX: number;
  homeScreenY: number;
};

// Barge types for ocean cargo transport
export type BargeState = 'approaching' | 'docking' | 'docked' | 'departing' | 'leaving';

export type Barge = {
  id: number;
  // Screen position (isometric coordinates)
  x: number;
  y: number;
  // Movement direction in radians
  angle: number;
  // Target angle for smooth turning
  targetAngle: number;
  // Current state
  state: BargeState;
  // Speed (pixels per second in screen space) - slower than boats
  speed: number;
  // Spawn edge of the map ('north' | 'south' | 'east' | 'west')
  spawnEdge: 'north' | 'south' | 'east' | 'west';
  // Spawn point (screen coordinates)
  spawnScreenX: number;
  spawnScreenY: number;
  // Target marina tile coordinates
  targetMarinaX: number;
  targetMarinaY: number;
  // Screen position of target marina
  targetScreenX: number;
  targetScreenY: number;
  // Lifetime/age tracking
  age: number;
  // Barge color/style
  color: string;
  // Wake particles (larger than boats)
  wake: WakeParticle[];
  // Progress for wake spawning
  wakeSpawnProgress: number;
  // Cargo type for visual variety (0 = containers, 1 = bulk, 2 = tanker)
  cargoType: number;
  // Economic value delivered when docked
  cargoValue: number;
  // Time spent docked (for loading/unloading)
  dockTime: number;
  // Max dock time before departing
  maxDockTime: number;
};

// Smog/smoke particle types for industrial factories
export type SmogParticle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  maxAge: number;
  size: number;
  opacity: number;
};

export type FactorySmog = {
  tileX: number;
  tileY: number;
  screenX: number;
  screenY: number;
  buildingType: 'factory_medium' | 'factory_large';
  particles: SmogParticle[];
  spawnTimer: number;
};

// Firework types for nighttime celebrations at stadiums, amusement parks, and marinas
export type FireworkState = 'launching' | 'exploding' | 'fading';

export type FireworkParticle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  maxAge: number;
  color: string;
  size: number;
  trail: { x: number; y: number; age: number }[];
};

export type Firework = {
  id: number;
  // Screen position (isometric coordinates)
  x: number;
  y: number;
  // Velocity
  vx: number;
  vy: number;
  // Current state
  state: FireworkState;
  // Launch target height (screen Y when it should explode)
  targetY: number;
  // Color for this firework
  color: string;
  // Explosion particles
  particles: FireworkParticle[];
  // Age tracking
  age: number;
  // Source building tile
  sourceTileX: number;
  sourceTileY: number;
};

// Cloud types for atmospheric effects - distinct meteorological cloud types
export type CloudType =
  | 'cumulus'       // Fluffy fair-weather clouds
  | 'stratus'       // Flat, layered overcast
  | 'cirrus'        // Wispy high-altitude
  | 'cumulonimbus'  // Towering storm clouds (dark base, white top)
  | 'altocumulus';  // Mid-level patchy mackerel sky

export type CloudPuff = {
  // Offset from cloud center (for multi-puff clouds)
  offsetX: number;
  offsetY: number;
  // Size of this puff (radius)
  size: number;
  // Opacity multiplier
  opacity: number;
  // Stretch for non-circular puffs: 1=round, >1=elongated (stratus: wide/flat, cirrus: wispy)
  stretchX?: number;
  stretchY?: number;
  // For cumulonimbus: 'base' (dark) or 'top' (bright) - undefined = use cloud default
  portion?: 'base' | 'top';
};

export type Cloud = {
  id: number;
  // Screen position (isometric coordinates)
  x: number;
  y: number;
  // Velocity (pixels per second)
  vx: number;
  vy: number;
  // Cloud size scale (1.0 = normal)
  scale: number;
  // Base opacity (0-1)
  opacity: number;
  // Array of puffs that make up this cloud
  puffs: CloudPuff[];
  // Altitude layer (0 = low, 1 = mid, 2 = high) - affects parallax
  layer: number;
  // Meteorological cloud type - determines shape, color, and rendering
  cloudType: CloudType;
};

// Direction metadata - re-export from core
export type { DirectionMeta } from '@/core/types/grid';

// World render state
export type WorldRenderState = {
  grid: import('@/types/game').Tile[][];
  gridSize: number;
  offset: { x: number; y: number };
  zoom: number;
  speed: number;
  canvasSize: { width: number; height: number };
};

// Overlay modes for visualization
export type OverlayMode = 'none' | 'power' | 'water' | 'fire' | 'police' | 'health' | 'education' | 'subway';

// ============================================================================
// Train Types
// ============================================================================

/** Train carriage type */
export type CarriageType = 'locomotive' | 'passenger' | 'freight_box' | 'freight_tank' | 'freight_flat' | 'caboose';

/** Train type (passenger or freight) */
export type TrainType = 'passenger' | 'freight';

/** Smoke particle for freight train locomotives */
export type TrainSmokeParticle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  maxAge: number;
  size: number;
  opacity: number;
};

/** Individual train carriage */
export type TrainCarriage = {
  type: CarriageType;
  color: string;
  // Position tracking for smooth multi-carriage movement
  tileX: number;
  tileY: number;
  progress: number;
  direction: CarDirection;
};

/** Complete train with multiple carriages */
export type Train = {
  id: number;
  type: TrainType;
  carriages: TrainCarriage[];
  // Lead locomotive position
  tileX: number;
  tileY: number;
  direction: CarDirection;
  progress: number;
  speed: number;
  // Path for the train
  path: { x: number; y: number }[];
  pathIndex: number;
  // Lifecycle
  age: number;
  maxAge: number;
  // Visual
  color: string;
  // Station stops
  atStation: boolean;
  stationWaitTimer: number;
  // Smoke particles for freight locomotives
  smokeParticles: TrainSmokeParticle[];
  smokeSpawnTimer: number;
};
