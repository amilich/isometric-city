import { BuildingType } from '@/games/isocity/types';
import { DirectionMeta } from '@/core/types';
import { CarDirection, TILE_WIDTH, TILE_HEIGHT } from './types';

// Vehicle colors (duller/muted versions)
export const CAR_COLORS = ['#d97777', '#d4a01f', '#2ba67a', '#4d84c8', '#9a6ac9'];

// Pedestrian appearance colors - includes lighter skin tones
export const PEDESTRIAN_SKIN_COLORS = ['#ffe4c4', '#ffd5b8', '#ffc8a8', '#fdbf7e', '#e0ac69', '#c68642', '#8d5524', '#613318'];
export const PEDESTRIAN_SHIRT_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff', '#1f2937'];
export const PEDESTRIAN_PANTS_COLORS = ['#1f2937', '#374151', '#4b5563', '#1e3a8a', '#7c2d12', '#365314'];
export const PEDESTRIAN_HAT_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f97316', '#8b5cf6', '#1f2937', '#ffffff'];

// Pedestrian behavior constants
export const PEDESTRIAN_BUILDING_ENTER_TIME = 0.8;  // Time to enter/exit building (seconds)
export const PEDESTRIAN_MIN_ACTIVITY_TIME = 20.0;   // Minimum time at an activity
export const PEDESTRIAN_MAX_ACTIVITY_TIME = 120.0;  // Maximum time at an activity
export const PEDESTRIAN_BUILDING_MIN_TIME = 30.0;   // Minimum time inside buildings
export const PEDESTRIAN_BUILDING_MAX_TIME = 240.0;  // Maximum time inside buildings
export const PEDESTRIAN_SOCIAL_CHANCE = 0.02;       // Chance to stop and socialize (reduced for perf)
export const PEDESTRIAN_SOCIAL_DURATION = 4.0;      // How long socializing lasts
export const PEDESTRIAN_DOG_CHANCE = 0.05;          // Chance of walking a dog (reduced for perf)
export const PEDESTRIAN_BAG_CHANCE = 0.15;          // Chance of carrying a bag
export const PEDESTRIAN_HAT_CHANCE = 0.15;          // Chance of wearing a hat
export const PEDESTRIAN_IDLE_CHANCE = 0.01;         // Chance to stop and idle briefly (reduced for perf)

// Beach/swimming pedestrian constants
export const PEDESTRIAN_BEACH_CHANCE = 0.15;        // Chance a park-bound pedestrian goes to beach instead
export const PEDESTRIAN_BEACH_MIN_TIME = 30.0;      // Minimum time at beach
export const PEDESTRIAN_BEACH_MAX_TIME = 180.0;     // Maximum time at beach
export const PEDESTRIAN_BEACH_SWIM_CHANCE = 0.6;    // Chance of swimming vs lying on mat
export const PEDESTRIAN_MAT_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22', '#1abc9c', '#ff69b4'];
export const MAX_BEACH_SWIMMERS_PER_TILE = 3;       // Max swimmers per water tile
export const MAX_BEACH_MATS_PER_EDGE = 2;           // Max mats per beach edge

// Pedestrian performance limits
export const PEDESTRIAN_MAX_COUNT = 560;            // Maximum pedestrians (hard cap) - reduced ~30%
export const PEDESTRIAN_MAX_COUNT_MOBILE = 80;      // Mobile: much lower for performance
export const PEDESTRIAN_ROAD_TILE_DENSITY = 1.7;    // Target pedestrians per road tile - reduced ~30%
export const PEDESTRIAN_ROAD_TILE_DENSITY_MOBILE = 0.5; // Mobile: lower density
export const PEDESTRIAN_SPAWN_BATCH_SIZE = 25;      // How many to try spawning at once
export const PEDESTRIAN_SPAWN_BATCH_SIZE_MOBILE = 5; // Mobile: smaller batches
export const PEDESTRIAN_SPAWN_INTERVAL = 0.03;      // Seconds between spawn batches
export const PEDESTRIAN_SPAWN_INTERVAL_MOBILE = 0.15; // Mobile: slower spawning
export const PEDESTRIAN_UPDATE_SKIP_DISTANCE = 30;  // Skip detailed updates for pedestrians this far from view

// Zoom limits for camera
export const ZOOM_MIN = 0.3;                      // Minimum zoom level (most zoomed out - for large maps/multiple cities)
export const ZOOM_MAX = 5;                       // Maximum zoom level (most zoomed in)

// Zoom thresholds for rendering detail elements
// Lower values = more zoomed out, higher values = more zoomed in required
export const CAR_MIN_ZOOM = 0.4;                  // Desktop car threshold (cars hidden when very zoomed out)
export const CAR_MIN_ZOOM_MOBILE = 0.45;          // Mobile car threshold (slightly higher for perf)
export const PEDESTRIAN_MIN_ZOOM = 0.5;           // Desktop pedestrian threshold
export const PEDESTRIAN_MIN_ZOOM_MOBILE = 0.55;   // Mobile pedestrian threshold (slightly higher for perf)

// Vehicle rendering thresholds - hide at very zoomed out levels for performance
export const VEHICLE_FAR_ZOOM_THRESHOLD = 0.25;   // Below this zoom: hide ALL vehicles/pedestrians on desktop too
export const TRAIN_MIN_ZOOM_FAR = 0.20;           // Trains visible slightly further out than cars
export const BOAT_MIN_ZOOM_FAR = 0.20;            // Boats visible at moderate zoom
export const HELICOPTER_MIN_ZOOM_FAR = 0.20;      // Helicopters visible at moderate zoom
export const AIRPLANE_MIN_ZOOM_FAR = 0;           // Airplanes always visible at all zoom levels
export const TRAFFIC_LIGHT_MIN_ZOOM = 0.45;       // Traffic lights at intersections
export const DIRECTION_ARROWS_MIN_ZOOM = 0.65;    // Directional arrows on merged roads
export const MEDIAN_PLANTS_MIN_ZOOM = 0.55;       // Plants/shrubs on road medians
export const LANE_MARKINGS_MIN_ZOOM = 0.5;        // Lane markings and road lines
export const LANE_MARKINGS_MEDIAN_MIN_ZOOM = 0.6; // Median markings for avenues/highways
export const SIDEWALK_MIN_ZOOM = 0.25;            // Sidewalks on road edges (desktop)
export const SIDEWALK_MIN_ZOOM_MOBILE = 0.25;     // Sidewalks on mobile (lower = visible when more zoomed out)
export const SKIP_SMALL_ELEMENTS_ZOOM_THRESHOLD = 0.5; // Desktop: hide boats/helis/smog during pan/zoom when below this

// Airplane system constants
export const AIRPLANE_MIN_POPULATION = 2000; // Minimum population required for airplane activity
export const AIRPLANE_COLORS = ['#ffffff', '#1e40af', '#dc2626', '#059669', '#7c3aed']; // Airline liveries (fallback)
export const CONTRAIL_MAX_AGE = 3.0; // seconds
export const CONTRAIL_SPAWN_INTERVAL = 0.02; // seconds between contrail particles

// Airplane sprite sheet configuration
export const AIRPLANE_SPRITE_SRC = '/assets/sprites_red_water_new_planes.png';
export const AIRPLANE_SPRITE_COLS = 5; // 5 columns per row
export const AIRPLANE_SPRITE_ROWS = 6; // 6 rows total
// Plane types by row (0-indexed): 737, 777, 747, a380, seaplane, g650
export const PLANE_TYPE_ROWS: Record<string, number> = {
  '737': 0,
  '777': 1,
  '747': 2,
  'a380': 3,
  'seaplane': 4, // Row 4 is the seaplane
  'g650': 5,
};
// Available plane types (weighted toward smaller planes for variety)
export const PLANE_TYPES: Array<'737' | '777' | '747' | 'a380' | 'g650'> = ['737', '737', '737', '777', '777', '747', 'g650'];
// Column mapping for each direction
// Col 0: SW (South West), Col 1: NE (North East), Col 2: W (West), Col 3: N (North top-down), Col 4: unused
// For opposite directions, mirror the sprite appropriately:
// - W→E: horizontal flip (mirrorX)
// - N→S: vertical flip (mirrorY)
// - SE: use NE sprite (col 1) with vertical flip
// - NW: use SW sprite (col 0) with vertical flip
// baseAngle = the angle the sprite visually faces; rotationOffset = planeAngle - baseAngle
export const PLANE_DIRECTION_COLS: Record<string, { col: number; mirrorX: boolean; mirrorY: boolean; baseAngle: number }> = {
  // Original sprites - baseAngle is what direction the sprite is drawn facing
  'sw': { col: 0, mirrorX: false, mirrorY: false, baseAngle: (3 * Math.PI) / 4 + 0.26 },  // ~150° - South West (col 0)
  'ne': { col: 1, mirrorX: false, mirrorY: false, baseAngle: -Math.PI / 4 + 0.17 },        // ~-35° - North East (col 1)
  'w': { col: 2, mirrorX: false, mirrorY: false, baseAngle: Math.PI },                    // 180° - West (col 2)
  'n': { col: 3, mirrorX: false, mirrorY: false, baseAngle: (3 * Math.PI) / 2 },          // 270° - North top-down (col 3)
  // Derived directions through mirroring
  'se': { col: 0, mirrorX: true, mirrorY: false, baseAngle: Math.PI / 4 - 0.26 },         // SW mirrored horizontally = SE
  'nw': { col: 1, mirrorX: false, mirrorY: true, baseAngle: Math.PI / 4 - 0.26 },         // NE mirrored vertically then rotated = NW (~30°)
  'e': { col: 2, mirrorX: true, mirrorY: false, baseAngle: 0 },                           // 0° - East (W mirrored horizontally)
  's': { col: 3, mirrorX: false, mirrorY: true, baseAngle: Math.PI / 2 },                 // 90° - South (N mirrored vertically)
};

// Direction overrides for planes that cannot use col 1 (NE): seaplane and g650
// Use col 3 (N) instead
export const COL1_OVERRIDE_PLANE_TYPES = ['seaplane', 'g650'];
export const COL1_DIRECTION_OVERRIDES: Record<string, { col: number; mirrorX: boolean; mirrorY: boolean; baseAngle: number }> = {
  'ne': { col: 3, mirrorX: true, mirrorY: false, baseAngle: -Math.PI / 4 - 0.69 },        // Use N sprite rotated for NE
  'se': { col: 3, mirrorX: true, mirrorY: true, baseAngle: (3 * Math.PI) / 4 - 0.78 },    // Use N sprite rotated for SE (30° clockwise)
  'nw': { col: 3, mirrorX: false, mirrorY: false, baseAngle: (3 * Math.PI) / 2 },         // Use N sprite (facing 270°) without mirroring, rotation handles NW
};
// Plane scale factors by type (larger planes are bigger)
// Scaled down 20% from previous values
export const PLANE_SCALES: Record<string, number> = {
  '737': 0.152,
  '777': 0.184,
  '747': 0.196,
  'a380': 0.224,
  'g650': 0.112,
  'seaplane': 0.09, // Scaled down 20% more (total ~45% from original)
};

// Seaplane system constants
export const SEAPLANE_MIN_POPULATION = 3000; // Minimum population for seaplanes
export const SEAPLANE_MIN_BAY_SIZE = 12; // Minimum water tiles for a bay to support seaplanes
export const SEAPLANE_COLORS = ['#ffffff', '#1e40af', '#dc2626', '#f97316', '#059669']; // Seaplane liveries
export const MAX_SEAPLANES = 25; // Maximum seaplanes in the city
export const MAX_SEAPLANES_MOBILE = 5; // Mobile: fewer seaplanes for performance
export const SEAPLANE_SPAWN_INTERVAL_MIN = 4; // Minimum seconds between spawns
export const SEAPLANE_SPAWN_INTERVAL_MAX = 10; // Maximum seconds between spawns
export const SEAPLANE_TAXI_TIME_MIN = 4; // Minimum seconds taxiing on water before takeoff
export const SEAPLANE_TAXI_TIME_MAX = 10; // Maximum seconds taxiing
export const SEAPLANE_DOCK_TIME_MIN = 8; // Minimum seconds docked at marina/pier
export const SEAPLANE_DOCK_TIME_MAX = 20; // Maximum seconds docked
export const SEAPLANE_FLIGHT_TIME_MIN = 25; // Minimum flight time in seconds
export const SEAPLANE_FLIGHT_TIME_MAX = 50; // Maximum flight time
export const SEAPLANE_WATER_SPEED = 18; // Speed when taxiing on water (px/sec)
export const SEAPLANE_DOCK_APPROACH_SPEED = 12; // Speed when approaching dock
export const SEAPLANE_TAKEOFF_SPEED = 60; // Speed during takeoff run
export const SEAPLANE_FLIGHT_SPEED_MIN = 70; // Minimum cruising speed
export const SEAPLANE_FLIGHT_SPEED_MAX = 100; // Maximum cruising speed
export const SEAPLANE_MIN_ZOOM = 0.3; // Minimum zoom to show seaplanes
export const SEAPLANE_MAX_FLIGHTS = 3; // Maximum flights before despawning

// Helicopter system constants
export const HELICOPTER_MIN_POPULATION = 3000; // Minimum population required for helicopter activity
export const HELICOPTER_COLORS = ['#dc2626', '#ffffff', '#1e3a8a', '#f97316', '#059669']; // Red cross, white, navy, orange, green
export const ROTOR_WASH_MAX_AGE = 1.0; // seconds - shorter than plane contrails
export const ROTOR_WASH_SPAWN_INTERVAL = 0.04; // seconds between rotor wash particles

// Water asset path
export const WATER_ASSET_PATH = '/assets/water.png';

// Boat system constants
export const BOAT_COLORS = ['#ffffff', '#1e3a5f', '#8b4513', '#2f4f4f', '#c41e3a', '#1e90ff']; // Various boat hull colors
export const BOAT_MIN_ZOOM = 0.3; // Minimum zoom level to show boats
export const WAKE_MIN_ZOOM_MOBILE = 0.45; // Minimum zoom level to show wakes on mobile (matches traffic lights threshold)
export const BOATS_PER_DOCK = 1.5; // Number of boats per marina/pier
export const BOATS_PER_DOCK_MOBILE = 0.5; // Mobile: fewer boats per dock
export const MAX_BOATS = 12; // Maximum total boats in the city
export const MAX_BOATS_MOBILE = 4; // Mobile: fewer boats for performance
export const WAKE_MAX_AGE = 2.0; // seconds - how long wake particles last
export const WAKE_SPAWN_INTERVAL = 0.03; // seconds between wake particles

// Barge system constants (ocean cargo ships)
export const BARGE_COLORS = ['#2c3e50', '#34495e', '#7f8c8d', '#c0392b', '#27ae60', '#2980b9']; // Industrial ship colors
export const BARGE_MIN_ZOOM = 0.25; // Minimum zoom level to show barges (slightly lower than boats)
export const BARGE_SPEED_MIN = 8; // Minimum speed (pixels/second) - slower than boats
export const BARGE_SPEED_MAX = 12; // Maximum speed (pixels/second)
export const MAX_BARGES = 4; // Maximum barges in the city at once
export const MAX_BARGES_MOBILE = 2; // Mobile: fewer barges for performance
export const BARGE_SPAWN_INTERVAL_MIN = 8; // Minimum seconds between barge spawns
export const BARGE_SPAWN_INTERVAL_MAX = 20; // Maximum seconds between barge spawns
export const BARGE_DOCK_TIME_MIN = 8; // Minimum seconds docked at marina
export const BARGE_DOCK_TIME_MAX = 15; // Maximum seconds docked at marina
export const BARGE_CARGO_VALUE_MIN = 100; // Minimum cargo value (adds to city income per delivery)
export const BARGE_CARGO_VALUE_MAX = 350; // Maximum cargo value (makes ocean marinas worthwhile)
export const BARGE_WAKE_SPAWN_INTERVAL = 0.05; // Slower wake spawn than boats (larger vessel)

// Factory smog system constants
export const SMOG_BUILDINGS: BuildingType[] = ['factory_medium', 'factory_large'];
export const SMOG_PARTICLE_MAX_AGE = 8.0; // seconds - how long smog particles last
export const SMOG_PARTICLE_MAX_AGE_MOBILE = 5.0; // seconds - shorter on mobile for performance
export const SMOG_SPAWN_INTERVAL_MEDIUM = 0.4; // seconds between particles for medium factory
export const SMOG_SPAWN_INTERVAL_LARGE = 0.2; // seconds between particles for large factory
export const SMOG_SPAWN_INTERVAL_MOBILE_MULTIPLIER = 2.0; // Spawn less frequently on mobile
export const SMOG_DRIFT_SPEED = 8; // pixels per second horizontal drift
export const SMOG_RISE_SPEED = 12; // pixels per second upward drift
export const SMOG_MAX_ZOOM = 1.2; // Zoom level above which smog starts to fade
export const SMOG_FADE_ZOOM = 1.8; // Zoom level at which smog is fully invisible
export const SMOG_BASE_OPACITY = 0.25; // Base opacity of smog particles
export const SMOG_PARTICLE_SIZE_MIN = 8; // Minimum particle size
export const SMOG_PARTICLE_SIZE_MAX = 20; // Maximum particle size
export const SMOG_PARTICLE_GROWTH = 0.5; // How much particles grow per second
export const SMOG_MAX_PARTICLES_PER_FACTORY = 25; // Maximum particles per factory to prevent memory issues
export const SMOG_MAX_PARTICLES_PER_FACTORY_MOBILE = 12; // Lower limit on mobile

// Train smoke constants (freight locomotives only)
export const TRAIN_SMOKE_PARTICLE_MAX_AGE = 1.8; // seconds - short-lived compact puffs
export const TRAIN_SMOKE_SPAWN_INTERVAL = 0.15; // seconds between puffs
export const TRAIN_SMOKE_SPAWN_INTERVAL_MOBILE = 0.3; // Less frequent on mobile
export const TRAIN_SMOKE_DRIFT_SPEED = 8; // pixels per second horizontal drift (slower)
export const TRAIN_SMOKE_RISE_SPEED = 18; // pixels per second upward drift
export const TRAIN_SMOKE_BASE_OPACITY = 0.5; // Higher opacity for compact puffs
export const TRAIN_SMOKE_PARTICLE_SIZE_MIN = 2; // Tiny puffs
export const TRAIN_SMOKE_PARTICLE_SIZE_MAX = 4; // Small max size
export const TRAIN_SMOKE_PARTICLE_GROWTH = 0.8; // Slow growth - stays compact
export const TRAIN_SMOKE_MAX_PARTICLES = 12; // Max particles per train
export const TRAIN_SMOKE_MAX_PARTICLES_MOBILE = 6;

// Firework system constants
export const FIREWORK_BUILDINGS: BuildingType[] = ['baseball_stadium', 'amusement_park', 'marina_docks_small', 'pier_large'];
export const FIREWORK_COLORS = [
  '#ff4444', '#ff6b6b', // Reds
  '#44ff44', '#6bff6b', // Greens
  '#4444ff', '#6b6bff', // Blues
  '#ffff44', '#ffff6b', // Yellows
  '#ff44ff', '#ff6bff', // Magentas
  '#44ffff', '#6bffff', // Cyans
  '#ff8844', '#ffaa44', // Oranges
  '#ffffff', '#ffffee', // Whites
];
export const FIREWORK_PARTICLE_COUNT = 40; // Particles per explosion
export const FIREWORK_PARTICLE_SPEED = 120; // Initial particle velocity
export const FIREWORK_PARTICLE_MAX_AGE = 1.5; // seconds - how long particles last
export const FIREWORK_LAUNCH_SPEED = 180; // pixels per second upward
export const FIREWORK_SPAWN_INTERVAL_MIN = 0.3; // seconds between firework launches
export const FIREWORK_SPAWN_INTERVAL_MAX = 1.2; // seconds between firework launches
export const FIREWORK_SHOW_DURATION = 45; // seconds - how long a firework show lasts
export const FIREWORK_SHOW_CHANCE = 0.35; // 35% chance of fireworks on any given night

// Direction metadata helpers
function createDirectionMeta(step: { x: number; y: number }, vec: { dx: number; dy: number }): DirectionMeta {
  const length = Math.hypot(vec.dx, vec.dy) || 1;
  return {
    step,
    vec,
    angle: Math.atan2(vec.dy, vec.dx),
    normal: { nx: -vec.dy / length, ny: vec.dx / length },
  };
}

export const DIRECTION_META: Record<CarDirection, DirectionMeta> = {
  north: createDirectionMeta({ x: -1, y: 0 }, { dx: -TILE_WIDTH / 2, dy: -TILE_HEIGHT / 2 }),
  east: createDirectionMeta({ x: 0, y: -1 }, { dx: TILE_WIDTH / 2, dy: -TILE_HEIGHT / 2 }),
  south: createDirectionMeta({ x: 1, y: 0 }, { dx: TILE_WIDTH / 2, dy: TILE_HEIGHT / 2 }),
  west: createDirectionMeta({ x: 0, y: 1 }, { dx: -TILE_WIDTH / 2, dy: TILE_HEIGHT / 2 }),
};

export const OPPOSITE_DIRECTION: Record<CarDirection, CarDirection> = {
  north: 'south',
  east: 'west',
  south: 'north',
  west: 'east',
};

// Traffic light timing constants (faster cycle)
export const TRAFFIC_LIGHT_GREEN_DURATION = 3.0;   // Seconds
export const TRAFFIC_LIGHT_YELLOW_DURATION = 0.8;  // Seconds
export const TRAFFIC_LIGHT_CYCLE = 7.6;            // Full cycle time

// Train system constants
export const TRAIN_MIN_ZOOM = 0.35;               // Minimum zoom to show trains (normal)
export const TRAIN_SPAWN_INTERVAL = 3.0;          // Seconds between train spawn attempts
export const TRAIN_SPAWN_INTERVAL_MOBILE = 6.0;   // Mobile: slower train spawning
export const MIN_RAIL_TILES_FOR_TRAINS = 10;      // Minimum rail tiles needed
export const MAX_TRAINS = 35;                      // Maximum trains in city
export const MAX_TRAINS_MOBILE = 8;               // Mobile: fewer trains for performance

// Far zoom thresholds - all mobile/animated entities hidden below these levels
export const HELICOPTER_MIN_ZOOM = 0.3;           // Minimum zoom to show helicopters
export const SMOG_MIN_ZOOM = 0.35;                // Minimum zoom to show factory smog
export const FIREWORK_MIN_ZOOM = 0.3;             // Minimum zoom to show fireworks

// PERF: Pre-computed building type sets for O(1) lookups during lighting calculations
// These are module-level constants to avoid allocating on every render frame
export const NON_LIT_BUILDING_TYPES = new Set(['grass', 'empty', 'water', 'road', 'tree', 'park', 'park_large', 'tennis']);
export const RESIDENTIAL_BUILDING_TYPES = new Set(['house_small', 'house_medium', 'mansion', 'apartment_low', 'apartment_high']);
export const COMMERCIAL_BUILDING_TYPES = new Set(['shop_small', 'shop_medium', 'office_low', 'office_high', 'mall']);
