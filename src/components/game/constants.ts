import { BuildingType } from '@/types/game';
import { CarDirection, DirectionMeta, TILE_WIDTH, TILE_HEIGHT } from './types';

// Vehicle colors
export const CAR_COLORS = ['#f87171', '#fbbf24', '#34d399', '#60a5fa', '#c084fc'];

// Pedestrian appearance colors
export const PEDESTRIAN_SKIN_COLORS = ['#fdbf7e', '#e0ac69', '#c68642', '#8d5524', '#613318'];
export const PEDESTRIAN_SHIRT_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff', '#1f2937'];

// Minimum zoom level to show pedestrians (zoomed in)
export const PEDESTRIAN_MIN_ZOOM = 0.5;

// Airplane system constants
export const AIRPLANE_MIN_POPULATION = 5000; // Minimum population required for airplane activity
export const AIRPLANE_COLORS = ['#ffffff', '#1e40af', '#dc2626', '#059669', '#7c3aed']; // Airline liveries
export const CONTRAIL_MAX_AGE = 3.0; // seconds
export const CONTRAIL_SPAWN_INTERVAL = 0.02; // seconds between contrail particles

// Helicopter system constants
export const HELICOPTER_MIN_POPULATION = 3000; // Minimum population required for helicopter activity
export const HELICOPTER_COLORS = ['#dc2626', '#ffffff', '#1e3a8a', '#f97316', '#059669']; // Red cross, white, navy, orange, green
export const ROTOR_WASH_MAX_AGE = 1.2; // seconds - shorter than plane contrails
export const ROTOR_WASH_SPAWN_INTERVAL = 0.04; // seconds between rotor wash particles

// Boat system constants
export const BOAT_COLORS = ['#ffffff', '#1e3a5f', '#8b4513', '#2f4f4f', '#c41e3a', '#1e90ff']; // Various boat hull colors
export const BOAT_MIN_ZOOM = 0.3; // Minimum zoom level to show boats
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

// Weather visual system constants
export const WEATHER_PARTICLE_MAX_COUNT = 500; // Maximum weather particles (rain/snow)
export const WEATHER_PARTICLE_MAX_COUNT_MOBILE = 150; // Lower on mobile for performance

// Rain particle constants
export const RAIN_DROP_SPEED_MIN = 400; // pixels per second
export const RAIN_DROP_SPEED_MAX = 600;
export const RAIN_DROP_LENGTH = 15; // Length of rain streak in pixels
export const RAIN_DROP_WIDTH = 1.5;
export const RAIN_DROP_COLOR = 'rgba(180, 200, 255, 0.6)';
export const RAIN_ANGLE = 0.15; // Slight angle to simulate wind (radians)
export const RAIN_SPAWN_RATE_LIGHT = 0.02; // Particles per pixel area per second (light rain)
export const RAIN_SPAWN_RATE_MODERATE = 0.05;
export const RAIN_SPAWN_RATE_HEAVY = 0.1;

// Snow particle constants
export const SNOW_FALL_SPEED_MIN = 30; // Much slower than rain
export const SNOW_FALL_SPEED_MAX = 80;
export const SNOW_PARTICLE_SIZE_MIN = 2;
export const SNOW_PARTICLE_SIZE_MAX = 5;
export const SNOW_COLOR = 'rgba(255, 255, 255, 0.9)';
export const SNOW_DRIFT_SPEED = 20; // Horizontal drift in pixels per second
export const SNOW_SPAWN_RATE_LIGHT = 0.015;
export const SNOW_SPAWN_RATE_MODERATE = 0.04;
export const SNOW_SPAWN_RATE_HEAVY = 0.08;

// Snow accumulation on ground/buildings (visual overlay)
export const SNOW_ACCUMULATION_OPACITY = 0.4; // White overlay opacity on buildings

// Lightning constants
export const LIGHTNING_FLASH_DURATION = 0.15; // seconds
export const LIGHTNING_FLASH_INTERVAL_MIN = 3; // seconds between flashes
export const LIGHTNING_FLASH_INTERVAL_MAX = 15;
export const LIGHTNING_BOLT_SEGMENTS = 8;
export const LIGHTNING_BOLT_COLOR = 'rgba(200, 220, 255, 0.95)';
export const LIGHTNING_FLASH_COLOR = 'rgba(255, 255, 255, 0.3)'; // Screen flash

// Cloud system constants
export const CLOUD_COUNT_MIN = 3;
export const CLOUD_COUNT_MAX = 12;
export const CLOUD_SPEED_MIN = 5; // pixels per second
export const CLOUD_SPEED_MAX = 20;
export const CLOUD_SIZE_MIN = 100;
export const CLOUD_SIZE_MAX = 300;
export const CLOUD_OPACITY_CLEAR = 0.3;
export const CLOUD_OPACITY_CLOUDY = 0.6;
export const CLOUD_OPACITY_RAIN = 0.8;
export const CLOUD_OPACITY_STORM = 0.9;
export const CLOUD_COLOR_NORMAL = 'rgba(255, 255, 255';
export const CLOUD_COLOR_STORM = 'rgba(80, 80, 100';

// Heatwave visual constants
export const HEATWAVE_SHIMMER_INTENSITY = 0.03; // Distortion amount
export const HEATWAVE_OVERLAY_COLOR = 'rgba(255, 200, 100, 0.08)'; // Warm tint

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
