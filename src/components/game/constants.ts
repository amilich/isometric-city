import { BuildingType } from '@/types/game';
import { CarDirection, DirectionMeta, TILE_WIDTH, TILE_HEIGHT } from './types';

// Vehicle colors (duller/muted versions)
export const CAR_COLORS = ['#d97777', '#d4a01f', '#2ba67a', '#4d84c8', '#9a6ac9'];

// Pedestrian appearance colors
export const PEDESTRIAN_SKIN_COLORS = ['#fdbf7e', '#e0ac69', '#c68642', '#8d5524', '#613318'];
export const PEDESTRIAN_SHIRT_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff', '#1f2937'];

// Zoom thresholds for rendering detail elements
// Lower values = more zoomed out, higher values = more zoomed in required
export const PEDESTRIAN_MIN_ZOOM = 0.5;           // Desktop pedestrian threshold
export const PEDESTRIAN_MIN_ZOOM_MOBILE = 0.55;   // Mobile pedestrian threshold (slightly higher for perf)
export const TRAFFIC_LIGHT_MIN_ZOOM = 0.45;       // Traffic lights at intersections
export const DIRECTION_ARROWS_MIN_ZOOM = 0.65;    // Directional arrows on merged roads
export const MEDIAN_PLANTS_MIN_ZOOM = 0.55;       // Plants/shrubs on road medians
export const LANE_MARKINGS_MIN_ZOOM = 0.5;        // Lane markings and road lines
export const LANE_MARKINGS_MEDIAN_MIN_ZOOM = 0.6; // Median markings for avenues/highways

// Airplane system constants
export const AIRPLANE_MIN_POPULATION = 5000; // Minimum population required for airplane activity
export const AIRPLANE_COLORS = ['#ffffff', '#1e40af', '#dc2626', '#059669', '#7c3aed']; // Airline liveries
export const CONTRAIL_MAX_AGE = 3.0; // seconds
export const CONTRAIL_SPAWN_INTERVAL = 0.02; // seconds between contrail particles

// Helicopter system constants
export const HELICOPTER_MIN_POPULATION = 3000; // Minimum population required for helicopter activity
export const HELICOPTER_COLORS = ['#dc2626', '#ffffff', '#1e3a8a', '#f97316', '#059669']; // Red cross, white, navy, orange, green
export const ROTOR_WASH_MAX_AGE = 1.0; // seconds - shorter than plane contrails
export const ROTOR_WASH_SPAWN_INTERVAL = 0.04; // seconds between rotor wash particles

// Boat system constants
export const BOAT_COLORS = ['#ffffff', '#1e3a5f', '#8b4513', '#2f4f4f', '#c41e3a', '#1e90ff']; // Various boat hull colors
export const BOAT_MIN_ZOOM = 0.3; // Minimum zoom level to show boats
export const WAKE_MIN_ZOOM_MOBILE = 0.45; // Minimum zoom level to show wakes on mobile (matches traffic lights threshold)
export const BOATS_PER_DOCK = 1.5; // Number of boats per marina/pier
export const MAX_BOATS = 12; // Maximum total boats in the city
export const WAKE_MAX_AGE = 2.0; // seconds - how long wake particles last
export const WAKE_SPAWN_INTERVAL = 0.03; // seconds between wake particles

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
export const TRAIN_MIN_ZOOM = 0.35;               // Minimum zoom to show trains
export const TRAIN_SPAWN_INTERVAL = 3.0;          // Seconds between train spawn attempts
export const MIN_RAIL_TILES_FOR_TRAINS = 10;      // Minimum rail tiles needed
export const MAX_TRAINS = 20;                      // Maximum trains in city
