// Game-specific types for rendering and animation

// Isometric tile dimensions (shared constants)
export const TILE_WIDTH = 64;
export const HEIGHT_RATIO = 0.60;
export const TILE_HEIGHT = TILE_WIDTH * HEIGHT_RATIO;
export const KEY_PAN_SPEED = 520; // Pixels per second for keyboard panning

// Car/Vehicle types
export type CarDirection = 'north' | 'east' | 'south' | 'west';

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
  waitingForLight: boolean;
};

// Airplane types for airport animation
export type AirplaneState = 'flying' | 'landing' | 'taking_off' | 'taxiing';

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
  // Plane color/style
  color: string;
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

// Pedestrian types and destinations
export type PedestrianDestType = 'school' | 'commercial' | 'industrial' | 'park' | 'home';

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
  walkOffset: number; // For walking animation
  sidewalkSide: 'left' | 'right'; // Which side of the road they walk on
  destType: PedestrianDestType;
  homeX: number;
  homeY: number;
  destX: number;
  destY: number;
  returningHome: boolean;
  path: { x: number; y: number }[];
  pathIndex: number;
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

// Direction metadata for vehicle movement
export type DirectionMeta = {
  step: { x: number; y: number };
  vec: { dx: number; dy: number };
  angle: number;
  normal: { nx: number; ny: number };
};

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
