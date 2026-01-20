/**
 * Dynamic Pedestrian System
 * 
 * Manages pedestrian behaviors including:
 * - Walking to destinations
 * - Entering and exiting buildings
 * - Participating in recreational activities
 * - Socializing with other pedestrians
 * - Varying activities based on building type
 */

import { Tile, BuildingType } from '@/types/game';
import {
  Pedestrian,
  PedestrianState,
  PedestrianActivity,
  PedestrianDestType,
  CarDirection,
  TILE_WIDTH,
  TILE_HEIGHT,
} from './types';
import {
  PEDESTRIAN_SKIN_COLORS,
  PEDESTRIAN_SHIRT_COLORS,
  PEDESTRIAN_PANTS_COLORS,
  PEDESTRIAN_HAT_COLORS,
  PEDESTRIAN_BUILDING_ENTER_TIME,
  PEDESTRIAN_APPROACH_TIME,
  PEDESTRIAN_MIN_ACTIVITY_TIME,
  PEDESTRIAN_MAX_ACTIVITY_TIME,
  PEDESTRIAN_BUILDING_MIN_TIME,
  PEDESTRIAN_BUILDING_MAX_TIME,
  PEDESTRIAN_SOCIAL_CHANCE,
  PEDESTRIAN_SOCIAL_DURATION,
  PEDESTRIAN_DOG_CHANCE,
  PEDESTRIAN_BAG_CHANCE,
  PEDESTRIAN_HAT_CHANCE,
  PEDESTRIAN_IDLE_CHANCE,
  PEDESTRIAN_BEACH_MIN_TIME,
  PEDESTRIAN_BEACH_MAX_TIME,
  PEDESTRIAN_BEACH_SWIM_CHANCE,
  PEDESTRIAN_MAT_COLORS,
} from './constants';
import { isRoadTile, getDirectionOptions, findPathOnRoads, getDirectionToTile, findNearestRoadToBuilding } from './utils';

// Building types that are recreational (pedestrians do activities here)
const RECREATION_BUILDINGS: BuildingType[] = [
  'park', 'park_large', 'tennis', 'basketball_courts', 'playground_small',
  'playground_large', 'baseball_field_small', 'soccer_field_small',
  'football_field', 'baseball_stadium', 'swimming_pool', 'skate_park',
  'mini_golf_course', 'bleachers_field', 'community_garden', 'pond_park',
  'amphitheater', 'community_center', 'campground', 'marina_docks_small',
  'pier_large', 'amusement_park', 'stadium', 'museum',
];

// Buildings pedestrians can enter and spend time inside
const ENTERABLE_BUILDINGS: BuildingType[] = [
  'shop_small', 'shop_medium', 'office_low', 'office_high', 'mall',
  'school', 'university', 'hospital', 'museum', 'community_center',
  'factory_small', 'factory_medium', 'factory_large', 'warehouse',
  'police_station', 'fire_station', 'city_hall', 'rail_station',
  'subway_station', 'mountain_lodge',
];

// Shop buildings where pedestrians visibly approach and shop
const SHOP_BUILDINGS: BuildingType[] = [
  'shop_small', 'shop_medium', 'mall',
];

// Map building types to possible activities
// IMPORTANT: Sports activities (basketball, tennis, soccer, baseball) should ONLY
// appear at their dedicated facilities, not at regular parks
const BUILDING_ACTIVITIES: Partial<Record<BuildingType, PedestrianActivity[]>> = {
  // Sports - ONLY at dedicated facilities
  'basketball_courts': ['playing_basketball', 'watching_game'],
  'tennis': ['playing_tennis', 'watching_game'],
  'soccer_field_small': ['playing_soccer', 'watching_game'],
  'baseball_field_small': ['playing_baseball', 'watching_game'],
  'football_field': ['playing_soccer', 'watching_game'],
  'baseball_stadium': ['watching_game', 'sitting_bench'],
  'stadium': ['watching_game', 'sitting_bench'],
  'bleachers_field': ['watching_game', 'sitting_bench'],
  
  // Recreation facilities
  'swimming_pool': ['swimming'],
  'skate_park': ['skateboarding', 'watching_game'],
  'playground_small': ['playground'],
  'playground_large': ['playground', 'sitting_bench'],
  'mini_golf_course': ['walking_dog', 'sitting_bench'],
  'go_kart_track': ['watching_game'],
  'roller_coaster_small': ['watching_game'],
  'amusement_park': ['walking_dog', 'sitting_bench', 'watching_game'],
  
  // Parks and relaxation - NO ball sports here
  'park': ['sitting_bench', 'picnicking', 'walking_dog'],
  'park_large': ['sitting_bench', 'picnicking', 'walking_dog'],
  'community_garden': ['sitting_bench', 'picnicking'],
  'pond_park': ['sitting_bench', 'picnicking', 'walking_dog'],
  'campground': ['sitting_bench', 'picnicking'],
  'amphitheater': ['watching_game', 'sitting_bench'],
  'greenhouse_garden': ['sitting_bench'],
  'mountain_trailhead': ['jogging', 'walking_dog'],
  
  // Waterfront
  'marina_docks_small': ['sitting_bench', 'walking_dog'],
  'pier_large': ['sitting_bench', 'walking_dog'],
  
  // Indoor activities (for when exiting)
  'shop_small': ['shopping'],
  'shop_medium': ['shopping'],
  'mall': ['shopping'],
  'office_low': ['working'],
  'office_high': ['working'],
  'office_building_small': ['working'],
  'factory_small': ['working'],
  'factory_medium': ['working'],
  'factory_large': ['working'],
  'warehouse': ['working'],
  'school': ['studying'],
  'university': ['studying'],
  'museum': ['watching_game', 'sitting_bench'],
  'community_center': ['sitting_bench', 'watching_game'],
};

// Activities that require the pedestrian to have a ball
const BALL_ACTIVITIES: PedestrianActivity[] = [
  'playing_basketball', 'playing_tennis', 'playing_soccer', 'playing_baseball'
];

/**
 * Get a random activity for a building type
 */
export function getActivityForBuilding(buildingType: BuildingType): PedestrianActivity {
  const activities = BUILDING_ACTIVITIES[buildingType];
  if (activities && activities.length > 0) {
    return activities[Math.floor(Math.random() * activities.length)];
  }
  return 'none';
}

/**
 * Check if a building type is recreational
 */
export function isRecreationalBuilding(buildingType: BuildingType): boolean {
  return RECREATION_BUILDINGS.includes(buildingType);
}

/**
 * Check if a building type can be entered by pedestrians
 */
export function canPedestrianEnterBuilding(buildingType: BuildingType): boolean {
  return ENTERABLE_BUILDINGS.includes(buildingType);
}

/**
 * Check if a building type is a shop (visible approach/shopping)
 */
export function isShopBuilding(buildingType: BuildingType): boolean {
  return SHOP_BUILDINGS.includes(buildingType);
}

/**
 * Generate random activity position offset within a tile
 * Spread pedestrians out within the tile bounds
 */
export function getRandomActivityOffset(): { x: number; y: number } {
  // Random offset to spread pedestrians within tile (stays inside diamond)
  return {
    x: (Math.random() - 0.5) * 20,
    y: (Math.random() - 0.5) * 10,
  };
}

/**
 * Create a new pedestrian with full properties
 */
export function createPedestrian(
  id: number,
  homeX: number,
  homeY: number,
  destX: number,
  destY: number,
  destType: PedestrianDestType,
  path: { x: number; y: number }[],
  startIndex: number,
  direction: CarDirection
): Pedestrian {
  const hasDog = destType === 'park' && Math.random() < PEDESTRIAN_DOG_CHANCE;
  const hasBag = (destType === 'commercial' || destType === 'industrial') && Math.random() < PEDESTRIAN_BAG_CHANCE;
  const hasHat = Math.random() < PEDESTRIAN_HAT_CHANCE;
  
  const startTile = path[startIndex];
  
  return {
    id,
    tileX: startTile.x,
    tileY: startTile.y,
    direction,
    progress: Math.random(),
    speed: 0.12 + Math.random() * 0.08,
    age: 0,
    maxAge: 120 + Math.random() * 180, // 2-5 minutes lifespan
    skinColor: PEDESTRIAN_SKIN_COLORS[Math.floor(Math.random() * PEDESTRIAN_SKIN_COLORS.length)],
    shirtColor: PEDESTRIAN_SHIRT_COLORS[Math.floor(Math.random() * PEDESTRIAN_SHIRT_COLORS.length)],
    pantsColor: PEDESTRIAN_PANTS_COLORS[Math.floor(Math.random() * PEDESTRIAN_PANTS_COLORS.length)],
    hasHat,
    hatColor: hasHat ? PEDESTRIAN_HAT_COLORS[Math.floor(Math.random() * PEDESTRIAN_HAT_COLORS.length)] : '#000000',
    walkOffset: Math.random() * Math.PI * 2,
    sidewalkSide: Math.random() < 0.5 ? 'left' : 'right',
    destType,
    homeX,
    homeY,
    destX,
    destY,
    returningHome: false,
    path,
    pathIndex: startIndex,
    // New behavioral properties
    state: 'walking',
    activity: 'none',
    activityProgress: 0,
    activityDuration: 0,
    buildingEntryProgress: 0,
    socialTarget: null,
    activityOffsetX: 0,
    activityOffsetY: 0,
    activityAnimTimer: Math.random() * Math.PI * 2,
    hasBall: false,
    hasDog,
    hasBag,
    // Beach properties
    hasBeachMat: false,
    matColor: PEDESTRIAN_MAT_COLORS[Math.floor(Math.random() * PEDESTRIAN_MAT_COLORS.length)],
    beachTileX: -1,
    beachTileY: -1,
    beachEdge: null,
  };
}

/**
 * Determine what should happen when pedestrian arrives at destination
 */
export function handleArrivalAtDestination(
  ped: Pedestrian,
  grid: Tile[][],
  gridSize: number
): void {
  const tile = grid[ped.destY]?.[ped.destX];
  if (!tile) return;
  
  const buildingType = tile.building.type;
  
  // Check if this is a recreational area
  if (isRecreationalBuilding(buildingType)) {
    // Start a recreational activity
    const activity = getActivityForBuilding(buildingType);
    ped.state = 'at_recreation';
    ped.activity = activity;
    ped.activityProgress = 0;
    ped.activityDuration = PEDESTRIAN_MIN_ACTIVITY_TIME + 
      Math.random() * (PEDESTRIAN_MAX_ACTIVITY_TIME - PEDESTRIAN_MIN_ACTIVITY_TIME);
    
    // Set up position within the activity area
    const offset = getRandomActivityOffset();
    ped.activityOffsetX = offset.x;
    ped.activityOffsetY = offset.y;
    
    // Give them a ball if doing ball sports
    if (BALL_ACTIVITIES.includes(activity)) {
      ped.hasBall = true;
    }
  }
  // Check if this is a shop - use visible approaching state
  else if (isShopBuilding(buildingType)) {
    // Start approaching the shop entrance (visible queuing)
    ped.state = 'approaching_shop';
    ped.buildingEntryProgress = 0;
    ped.activityDuration = PEDESTRIAN_BUILDING_MIN_TIME + 
      Math.random() * (PEDESTRIAN_BUILDING_MAX_TIME - PEDESTRIAN_BUILDING_MIN_TIME);
    
    // Position at the shop entrance
    const offset = getRandomActivityOffset();
    ped.activityOffsetX = offset.x * 0.5; // Smaller offset to stay near entrance
    ped.activityOffsetY = offset.y * 0.3;
    
    // Set activity to shopping
    ped.activity = 'shopping';
  }
  // Check if this is an enterable building (non-shop)
  else if (canPedestrianEnterBuilding(buildingType)) {
    // Start entering the building
    ped.state = 'entering_building';
    ped.buildingEntryProgress = 0;
    ped.activityDuration = PEDESTRIAN_BUILDING_MIN_TIME + 
      Math.random() * (PEDESTRIAN_BUILDING_MAX_TIME - PEDESTRIAN_BUILDING_MIN_TIME);
    
    // Set activity based on building type
    ped.activity = getActivityForBuilding(buildingType);
  }
  // Otherwise just turn around and go home
  else {
    ped.returningHome = true;
  }
}

/**
 * Update a pedestrian's state machine
 */
export function updatePedestrianState(
  ped: Pedestrian,
  delta: number,
  speedMultiplier: number,
  grid: Tile[][],
  gridSize: number,
  allPedestrians: Pedestrian[]
): boolean {
  // Update age
  ped.age += delta;
  if (ped.age > ped.maxAge) {
    return false; // Pedestrian should be removed
  }
  
  // Update activity animation timer
  ped.activityAnimTimer += delta * 4;
  
  switch (ped.state) {
    case 'walking':
      return updateWalkingState(ped, delta, speedMultiplier, grid, gridSize, allPedestrians);
    
    case 'approaching_shop':
      return updateApproachingShopState(ped, delta, speedMultiplier);
    
    case 'entering_building':
      return updateEnteringBuildingState(ped, delta, speedMultiplier);
    
    case 'inside_building':
      return updateInsideBuildingState(ped, delta, speedMultiplier, grid, gridSize);
    
    case 'exiting_building':
      return updateExitingBuildingState(ped, delta, speedMultiplier, grid, gridSize);
    
    case 'at_recreation':
      return updateRecreationState(ped, delta, speedMultiplier, grid, gridSize);
    
    case 'at_beach':
      return updateBeachState(ped, delta, speedMultiplier, grid, gridSize);
    
    case 'idle':
      return updateIdleState(ped, delta, speedMultiplier);
    
    case 'socializing':
      return updateSocializingState(ped, delta, speedMultiplier, allPedestrians);
    
    default:
      return true;
  }
}

/**
 * Update walking state - the main movement logic
 * Optimized: reduced social/idle checks, simplified logic
 */
function updateWalkingState(
  ped: Pedestrian,
  delta: number,
  speedMultiplier: number,
  grid: Tile[][],
  gridSize: number,
  allPedestrians: Pedestrian[]
): boolean {
  // Update walk animation
  ped.walkOffset += delta * 8;
  
  // Only check social/idle occasionally (based on pedestrian ID for distribution)
  // This spreads the checks across frames instead of all at once
  const checkFrame = (ped.id + Math.floor(ped.age * 10)) % 60 === 0;
  
  if (checkFrame) {
    // Check if we should stop to socialize (very rare)
    if (Math.random() < PEDESTRIAN_SOCIAL_CHANCE) {
      const nearbyPed = findNearbyPedestrianFast(ped, allPedestrians);
      if (nearbyPed) {
        // Set up socializing state for both pedestrians
        ped.state = 'socializing';
        ped.socialTarget = nearbyPed.id;
        ped.activityDuration = PEDESTRIAN_SOCIAL_DURATION;
        ped.activityProgress = 0;
        nearbyPed.state = 'socializing';
        nearbyPed.socialTarget = ped.id;
        nearbyPed.activityDuration = PEDESTRIAN_SOCIAL_DURATION;
        nearbyPed.activityProgress = 0;
        
        // Offset pedestrians so they face each other and don't overlap
        // Use activity offsets to position them on opposite sides
        const offsetDistance = 8; // pixels apart
        ped.activityOffsetX = -offsetDistance;
        ped.activityOffsetY = 0;
        nearbyPed.activityOffsetX = offsetDistance;
        nearbyPed.activityOffsetY = 0;
        
        return true;
      }
    }
    
    // Random chance to idle briefly (very rare)
    if (Math.random() < PEDESTRIAN_IDLE_CHANCE) {
      ped.state = 'idle';
      ped.activityDuration = 1 + Math.random() * 2;
      ped.activityProgress = 0;
      return true;
    }
  }
  
  // Check if on road (skip if we recently checked - once per tile is enough)
  if (ped.progress < 0.1 && !isRoadTile(grid, gridSize, ped.tileX, ped.tileY)) {
    return false;
  }
  
  // Move along path
  ped.progress += ped.speed * delta * speedMultiplier;
  
  // Handle path progression
  while (ped.progress >= 1 && ped.pathIndex < ped.path.length - 1) {
    ped.pathIndex++;
    ped.progress -= 1;
    
    const currentTile = ped.path[ped.pathIndex];
    if (currentTile.x < 0 || currentTile.x >= gridSize ||
        currentTile.y < 0 || currentTile.y >= gridSize) {
      return false;
    }
    
    ped.tileX = currentTile.x;
    ped.tileY = currentTile.y;
    
    // Check if reached end of path
    if (ped.pathIndex >= ped.path.length - 1) {
      if (!ped.returningHome) {
        // Arrived at destination
        handleArrivalAtDestination(ped, grid, gridSize);
        return true;
      } else {
        // Arrived home
        return false;
      }
    }
    
    // Update direction
    if (ped.pathIndex + 1 < ped.path.length) {
      const nextTile = ped.path[ped.pathIndex + 1];
      const dir = getDirectionToTile(ped.tileX, ped.tileY, nextTile.x, nextTile.y);
      if (dir) ped.direction = dir;
    }
  }
  
  // Handle reaching end of path
  if (ped.progress >= 1 && ped.pathIndex >= ped.path.length - 1) {
    if (!ped.returningHome) {
      handleArrivalAtDestination(ped, grid, gridSize);
    } else {
      return false;
    }
  }
  
  return true;
}

/**
 * Update approaching shop state - pedestrian waits at shop entrance
 */
function updateApproachingShopState(
  ped: Pedestrian,
  delta: number,
  speedMultiplier: number
): boolean {
  // Animate the pedestrian looking around / waiting
  ped.walkOffset += delta * 2; // Slow idle animation
  
  ped.buildingEntryProgress += delta * speedMultiplier / PEDESTRIAN_APPROACH_TIME;
  
  if (ped.buildingEntryProgress >= 1) {
    // Done waiting, now enter the building
    ped.state = 'entering_building';
    ped.buildingEntryProgress = 0;
  }
  
  return true;
}

/**
 * Update entering building state
 */
function updateEnteringBuildingState(
  ped: Pedestrian,
  delta: number,
  speedMultiplier: number
): boolean {
  ped.buildingEntryProgress += delta * speedMultiplier / PEDESTRIAN_BUILDING_ENTER_TIME;
  
  if (ped.buildingEntryProgress >= 1) {
    ped.state = 'inside_building';
    ped.buildingEntryProgress = 1;
    ped.activityProgress = 0;
  }
  
  return true;
}

/**
 * Update inside building state
 */
function updateInsideBuildingState(
  ped: Pedestrian,
  delta: number,
  speedMultiplier: number,
  grid: Tile[][],
  gridSize: number
): boolean {
  ped.activityProgress += delta * speedMultiplier / ped.activityDuration;
  
  if (ped.activityProgress >= 1) {
    // Time to leave the building
    ped.state = 'exiting_building';
    ped.buildingEntryProgress = 1;
    
    // If was shopping, now carry a shopping bag!
    if (ped.activity === 'shopping') {
      ped.hasBag = true;
    }
  }
  
  return true;
}

/**
 * Update exiting building state
 */
function updateExitingBuildingState(
  ped: Pedestrian,
  delta: number,
  speedMultiplier: number,
  grid: Tile[][],
  gridSize: number
): boolean {
  ped.buildingEntryProgress -= delta * speedMultiplier / PEDESTRIAN_BUILDING_ENTER_TIME;
  
  if (ped.buildingEntryProgress <= 0) {
    ped.buildingEntryProgress = 0;
    ped.activity = 'none';
    
    // Start heading home
    const returnPath = findPathOnRoads(grid, gridSize, ped.destX, ped.destY, ped.homeX, ped.homeY);
    if (returnPath && returnPath.length > 0) {
      ped.path = returnPath;
      ped.pathIndex = 0;
      ped.progress = 0;
      ped.tileX = returnPath[0].x;
      ped.tileY = returnPath[0].y;
      ped.state = 'walking';
      ped.returningHome = true;
      
      if (returnPath.length > 1) {
        const nextTile = returnPath[1];
        const dir = getDirectionToTile(returnPath[0].x, returnPath[0].y, nextTile.x, nextTile.y);
        if (dir) ped.direction = dir;
      }
    } else {
      return false; // No path home, remove pedestrian
    }
  }
  
  return true;
}

/**
 * Update recreation state
 */
function updateRecreationState(
  ped: Pedestrian,
  delta: number,
  speedMultiplier: number,
  grid: Tile[][],
  gridSize: number
): boolean {
  ped.activityProgress += delta * speedMultiplier / ped.activityDuration;
  
  // Animate based on activity
  if (ped.activity === 'jogging') {
    // Joggers move around within the area
    ped.walkOffset += delta * 10;
    const jogRadius = 15;
    ped.activityOffsetX = Math.sin(ped.activityAnimTimer * 0.5) * jogRadius;
    ped.activityOffsetY = Math.cos(ped.activityAnimTimer * 0.3) * jogRadius * 0.6;
  } else if (ped.activity === 'walking_dog') {
    // Dog walkers move slowly
    ped.walkOffset += delta * 4;
    const walkRadius = 10;
    ped.activityOffsetX = Math.sin(ped.activityAnimTimer * 0.2) * walkRadius;
    ped.activityOffsetY = Math.cos(ped.activityAnimTimer * 0.15) * walkRadius * 0.6;
  }
  
  if (ped.activityProgress >= 1) {
    // Done with activity, head home
    ped.hasBall = false;
    ped.activity = 'none';
    
    const returnPath = findPathOnRoads(grid, gridSize, ped.destX, ped.destY, ped.homeX, ped.homeY);
    if (returnPath && returnPath.length > 0) {
      ped.path = returnPath;
      ped.pathIndex = 0;
      ped.progress = 0;
      ped.tileX = returnPath[0].x;
      ped.tileY = returnPath[0].y;
      ped.state = 'walking';
      ped.returningHome = true;
      
      if (returnPath.length > 1) {
        const nextTile = returnPath[1];
        const dir = getDirectionToTile(returnPath[0].x, returnPath[0].y, nextTile.x, nextTile.y);
        if (dir) ped.direction = dir;
      }
    } else {
      return false;
    }
  }
  
  return true;
}

/**
 * Update beach state (swimming or lying on mat)
 */
function updateBeachState(
  ped: Pedestrian,
  delta: number,
  speedMultiplier: number,
  grid: Tile[][],
  gridSize: number
): boolean {
  ped.activityProgress += delta * speedMultiplier / ped.activityDuration;
  
  // Animate based on activity
  if (ped.activity === 'beach_swimming') {
    // Swimmers bob and move in the water
    ped.walkOffset += delta * 3;
    // Gentle movement in the water, staying near the shore
    const swimRadius = 6;
    ped.activityOffsetX += (Math.sin(ped.activityAnimTimer * 0.3) * 0.1 - ped.activityOffsetX * 0.02) * delta * 10;
    ped.activityOffsetY += (Math.cos(ped.activityAnimTimer * 0.2) * 0.05 - ped.activityOffsetY * 0.02) * delta * 10;
    // Clamp to stay in reasonable area
    ped.activityOffsetX = Math.max(-swimRadius, Math.min(swimRadius, ped.activityOffsetX));
    ped.activityOffsetY = Math.max(-swimRadius * 0.5, Math.min(swimRadius * 0.5, ped.activityOffsetY));
  } else if (ped.activity === 'lying_on_mat') {
    // Person on mat barely moves - occasional shift
    if (Math.random() < 0.001) {
      ped.activityOffsetX += (Math.random() - 0.5) * 0.5;
      ped.activityOffsetY += (Math.random() - 0.5) * 0.25;
    }
  }
  
  if (ped.activityProgress >= 1) {
    // Done at beach, head home
    ped.activity = 'none';
    ped.hasBeachMat = false;
    ped.beachEdge = null;
    
    const returnPath = findPathOnRoads(grid, gridSize, ped.destX, ped.destY, ped.homeX, ped.homeY);
    if (returnPath && returnPath.length > 0) {
      ped.path = returnPath;
      ped.pathIndex = 0;
      ped.progress = 0;
      ped.tileX = returnPath[0].x;
      ped.tileY = returnPath[0].y;
      ped.state = 'walking';
      ped.returningHome = true;
      
      if (returnPath.length > 1) {
        const nextTile = returnPath[1];
        const dir = getDirectionToTile(returnPath[0].x, returnPath[0].y, nextTile.x, nextTile.y);
        if (dir) ped.direction = dir;
      }
    } else {
      return false;
    }
  }
  
  return true;
}

/**
 * Update idle state
 */
function updateIdleState(
  ped: Pedestrian,
  delta: number,
  speedMultiplier: number
): boolean {
  ped.activityProgress += delta * speedMultiplier / ped.activityDuration;
  
  if (ped.activityProgress >= 1) {
    ped.state = 'walking';
    ped.activityProgress = 0;
  }
  
  return true;
}

/**
 * Update socializing state
 */
function updateSocializingState(
  ped: Pedestrian,
  delta: number,
  speedMultiplier: number,
  allPedestrians: Pedestrian[]
): boolean {
  ped.activityProgress += delta * speedMultiplier / ped.activityDuration;
  
  // Check if partner is still socializing
  if (ped.socialTarget !== null) {
    const partner = allPedestrians.find(p => p.id === ped.socialTarget);
    if (!partner) {
      // Partner no longer exists, stop socializing
      ped.state = 'walking';
      ped.socialTarget = null;
      ped.activityProgress = 0;
      ped.activityOffsetX = 0;
      ped.activityOffsetY = 0;
      return true;
    }
    
    // If partner is no longer socializing with us (they may have just finished),
    // we should also finish but don't abruptly disappear - complete our transition
    if (partner.state !== 'socializing' || partner.socialTarget !== ped.id) {
      ped.state = 'walking';
      ped.socialTarget = null;
      ped.activityProgress = 0;
      ped.activityOffsetX = 0;
      ped.activityOffsetY = 0;
      return true;
    }
  }
  
  if (ped.activityProgress >= 1) {
    // Finished socializing - also signal partner to finish
    if (ped.socialTarget !== null) {
      const partner = allPedestrians.find(p => p.id === ped.socialTarget);
      if (partner && partner.state === 'socializing') {
        // Set partner's progress to complete so they finish on next update
        partner.activityProgress = 1;
      }
    }
    
    ped.state = 'walking';
    ped.socialTarget = null;
    ped.activityProgress = 0;
    ped.activityOffsetX = 0;
    ped.activityOffsetY = 0;
  }
  
  return true;
}

/**
 * Find a nearby pedestrian for socializing - optimized version
 * Only checks a limited number of pedestrians to avoid O(n²) behavior
 * Prefers adjacent tile matches to avoid same-position overlapping
 */
function findNearbyPedestrianFast(
  ped: Pedestrian,
  allPedestrians: Pedestrian[]
): Pedestrian | null {
  // Only check up to 20 pedestrians to avoid performance issues
  const checkLimit = Math.min(20, allPedestrians.length);
  const startIdx = ped.id % Math.max(1, allPedestrians.length - checkLimit);
  
  let sameTileMatch: Pedestrian | null = null;
  
  for (let i = 0; i < checkLimit; i++) {
    const idx = (startIdx + i) % allPedestrians.length;
    const other = allPedestrians[idx];
    
    if (other.id === ped.id) continue;
    if (other.state !== 'walking') continue;
    if (other.socialTarget !== null) continue;
    
    // Quick distance check - same tile or adjacent
    const dist = Math.abs(other.tileX - ped.tileX) + Math.abs(other.tileY - ped.tileY);
    
    if (dist === 1) {
      // Adjacent tile - prefer this to avoid overlap issues
      return other;
    } else if (dist === 0 && !sameTileMatch) {
      // Same tile - only use if no adjacent tile match found
      // Also check they're not on the same sidewalk side to reduce overlap
      if (other.sidewalkSide !== ped.sidewalkSide) {
        sameTileMatch = other;
      }
    }
  }
  
  return sameTileMatch;
}

/**
 * Spawn a pedestrian inside a shop/enterable building
 * They will be partway through their shopping/activity time
 */
export function spawnPedestrianInsideBuilding(
  id: number,
  buildingX: number,
  buildingY: number,
  grid: Tile[][],
  gridSize: number,
  homeX: number,
  homeY: number
): Pedestrian | null {
  const tile = grid[buildingY]?.[buildingX];
  if (!tile) return null;
  
  // Verify this is an enterable building
  if (!canPedestrianEnterBuilding(tile.building.type)) return null;
  
  // Find nearest road to spawn on when they exit
  const roadTile = findNearestRoadToBuilding(grid, gridSize, buildingX, buildingY);
  if (!roadTile) return null;
  
  // Find path home (for when they're done)
  const path = findPathOnRoads(grid, gridSize, roadTile.x, roadTile.y, homeX, homeY);
  if (!path || path.length === 0) return null;
  
  const ped = createPedestrian(
    id,
    homeX,
    homeY,
    buildingX,
    buildingY,
    getDestTypeForBuilding(tile.building.type),
    path,
    0,
    'south'
  );
  
  // Start already inside the building
  ped.state = 'inside_building';
  ped.buildingEntryProgress = 1; // Fully inside
  ped.activity = getActivityForBuilding(tile.building.type);
  ped.activityProgress = Math.random() * 0.6; // Already partway through
  ped.activityDuration = PEDESTRIAN_BUILDING_MIN_TIME +
    Math.random() * (PEDESTRIAN_BUILDING_MAX_TIME - PEDESTRIAN_BUILDING_MIN_TIME);
  
  // Position at the building (for when they exit)
  ped.tileX = roadTile.x;
  ped.tileY = roadTile.y;
  
  return ped;
}

/**
 * Spawn a pedestrian approaching a shop (visible at entrance)
 */
export function spawnPedestrianApproachingShop(
  id: number,
  shopX: number,
  shopY: number,
  grid: Tile[][],
  gridSize: number,
  homeX: number,
  homeY: number
): Pedestrian | null {
  const tile = grid[shopY]?.[shopX];
  if (!tile) return null;
  
  // Verify this is a shop building
  if (!isShopBuilding(tile.building.type)) return null;
  
  // Find nearest road
  const roadTile = findNearestRoadToBuilding(grid, gridSize, shopX, shopY);
  if (!roadTile) return null;
  
  // Find path home (for when they're done)
  const path = findPathOnRoads(grid, gridSize, roadTile.x, roadTile.y, homeX, homeY);
  if (!path || path.length === 0) return null;
  
  const ped = createPedestrian(
    id,
    homeX,
    homeY,
    shopX,
    shopY,
    'commercial',
    path,
    0,
    'south'
  );
  
  // Start at approaching shop state
  ped.state = 'approaching_shop';
  ped.buildingEntryProgress = Math.random() * 0.8; // Partway through approach
  ped.activity = 'shopping';
  ped.activityDuration = PEDESTRIAN_BUILDING_MIN_TIME +
    Math.random() * (PEDESTRIAN_BUILDING_MAX_TIME - PEDESTRIAN_BUILDING_MIN_TIME);
  
  // Random offset at entrance
  const offset = getRandomActivityOffset();
  ped.activityOffsetX = offset.x * 0.5;
  ped.activityOffsetY = offset.y * 0.3;
  
  // Position at the shop
  ped.tileX = shopX;
  ped.tileY = shopY;
  
  return ped;
}

/**
 * Get destination type for a building type
 */
function getDestTypeForBuilding(buildingType: BuildingType): PedestrianDestType {
  if (buildingType === 'school' || buildingType === 'university') {
    return 'school';
  }
  if (buildingType === 'shop_small' || buildingType === 'shop_medium' || 
      buildingType === 'mall' || buildingType === 'office_low' || 
      buildingType === 'office_high') {
    return 'commercial';
  }
  if (buildingType === 'factory_small' || buildingType === 'factory_medium' || 
      buildingType === 'factory_large' || buildingType === 'warehouse') {
    return 'industrial';
  }
  return 'home';
}

/**
 * Spawn a pedestrian that exits from a building
 */
export function spawnPedestrianFromBuilding(
  id: number,
  buildingX: number,
  buildingY: number,
  grid: Tile[][],
  gridSize: number,
  homeX: number,
  homeY: number
): Pedestrian | null {
  // Find nearest road to spawn on
  const roadTile = findNearestRoadToBuilding(grid, gridSize, buildingX, buildingY);
  if (!roadTile) return null;
  
  // Find path home
  const path = findPathOnRoads(grid, gridSize, roadTile.x, roadTile.y, homeX, homeY);
  if (!path || path.length === 0) return null;
  
  // Determine direction
  let direction: CarDirection = 'south';
  if (path.length > 1) {
    const nextTile = path[1];
    const dir = getDirectionToTile(roadTile.x, roadTile.y, nextTile.x, nextTile.y);
    if (dir) direction = dir;
  }
  
  const ped = createPedestrian(
    id,
    homeX,
    homeY,
    buildingX, // dest becomes where they came from
    buildingY,
    'home', // heading home
    path,
    0,
    direction
  );
  
  // Start in exiting state
  ped.state = 'exiting_building';
  ped.buildingEntryProgress = 1;
  ped.returningHome = true;
  
  return ped;
}

/**
 * Spawn a pedestrian at a recreational area already doing an activity
 */
export function spawnPedestrianAtRecreation(
  id: number,
  areaX: number,
  areaY: number,
  grid: Tile[][],
  gridSize: number,
  homeX: number,
  homeY: number
): Pedestrian | null {
  const tile = grid[areaY]?.[areaX];
  if (!tile) return null;
  
  // Find a road near the recreation area for eventual path home
  const roadTile = findNearestRoadToBuilding(grid, gridSize, areaX, areaY);
  if (!roadTile) return null;
  
  // Find path home (for when they're done)
  const path = findPathOnRoads(grid, gridSize, roadTile.x, roadTile.y, homeX, homeY);
  if (!path || path.length === 0) return null;
  
  const ped = createPedestrian(
    id,
    homeX,
    homeY,
    areaX,
    areaY,
    'park',
    path,
    0,
    'south'
  );
  
  // Start already at recreation
  const activity = getActivityForBuilding(tile.building.type);
  ped.state = 'at_recreation';
  ped.activity = activity;
  ped.activityProgress = Math.random() * 0.5; // Already partway through
  ped.activityDuration = PEDESTRIAN_MIN_ACTIVITY_TIME +
    Math.random() * (PEDESTRIAN_MAX_ACTIVITY_TIME - PEDESTRIAN_MIN_ACTIVITY_TIME);
  
  const offset = getRandomActivityOffset();
  ped.activityOffsetX = offset.x;
  ped.activityOffsetY = offset.y;
  
  if (BALL_ACTIVITIES.includes(activity)) {
    ped.hasBall = true;
  }
  
  // Position at the recreation area
  ped.tileX = areaX;
  ped.tileY = areaY;
  
  return ped;
}

/**
 * Get visible pedestrians (filter out ones inside buildings)
 */
export function getVisiblePedestrians(pedestrians: Pedestrian[]): Pedestrian[] {
  return pedestrians.filter(ped => ped.state !== 'inside_building');
}

/**
 * Get opacity for pedestrian (for enter/exit animations)
 * Shoppers stay visible at shop entrance (no fade), others fade in/out
 */
export function getPedestrianOpacity(ped: Pedestrian): number {
  // Shoppers stay visible at entrances - only fade when actually going inside
  if (ped.activity === 'shopping') {
    switch (ped.state) {
      case 'approaching_shop':
        return 1; // Fully visible while approaching
      case 'entering_building':
        // Only start fading at 50% progress (walk into door first)
        return ped.buildingEntryProgress < 0.5 ? 1 : 1 - (ped.buildingEntryProgress - 0.5) * 2;
      case 'exiting_building':
        // Fade in quickly at the start
        return ped.buildingEntryProgress > 0.5 ? 1 : ped.buildingEntryProgress * 2;
      case 'inside_building':
        return 0;
      default:
        return 1;
    }
  }
  
  // Non-shop buildings: simple fade
  switch (ped.state) {
    case 'entering_building':
      return 1 - ped.buildingEntryProgress;
    case 'exiting_building':
      return 1 - ped.buildingEntryProgress;
    case 'inside_building':
      return 0;
    default:
      return 1;
  }
}

// ============================================================================
// Beach/Swimming Functions
// ============================================================================

/**
 * Beach tile info with edge direction
 */
export type BeachTileInfo = {
  waterX: number;      // Water tile X
  waterY: number;      // Water tile Y
  landX: number;       // Adjacent land tile X
  landY: number;       // Adjacent land tile Y
  edge: 'north' | 'east' | 'south' | 'west'; // Which edge of water tile faces land
};

/**
 * Find all beach tiles (water tiles with adjacent land, excluding marinas/piers)
 */
export function findBeachTiles(
  grid: Tile[][],
  gridSize: number
): BeachTileInfo[] {
  const beachTiles: BeachTileInfo[] = [];
  
  // Marina/pier building types to exclude
  const marinaPierTypes: BuildingType[] = ['marina_docks_small', 'pier_large'];
  
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const tile = grid[y]?.[x];
      if (!tile || tile.building.type !== 'water') continue;
      
      // Check each adjacent tile for land
      const adjacentChecks: { dx: number; dy: number; edge: 'north' | 'east' | 'south' | 'west' }[] = [
        { dx: -1, dy: 0, edge: 'north' },
        { dx: 0, dy: -1, edge: 'east' },
        { dx: 1, dy: 0, edge: 'south' },
        { dx: 0, dy: 1, edge: 'west' },
      ];
      
      for (const check of adjacentChecks) {
        const adjX = x + check.dx;
        const adjY = y + check.dy;
        
        // Check bounds
        if (adjX < 0 || adjX >= gridSize || adjY < 0 || adjY >= gridSize) continue;
        
        const adjTile = grid[adjY]?.[adjX];
        if (!adjTile) continue;
        
        // Is it land (not water) and not a marina/pier?
        if (adjTile.building.type !== 'water' && 
            !marinaPierTypes.includes(adjTile.building.type)) {
          beachTiles.push({
            waterX: x,
            waterY: y,
            landX: adjX,
            landY: adjY,
            edge: check.edge,
          });
        }
      }
    }
  }
  
  return beachTiles;
}

/**
 * Get a random beach tile from the list
 */
export function getRandomBeachTile(beachTiles: BeachTileInfo[]): BeachTileInfo | null {
  if (beachTiles.length === 0) return null;
  return beachTiles[Math.floor(Math.random() * beachTiles.length)];
}

/**
 * Spawn a pedestrian at the beach already swimming or on a mat
 */
export function spawnPedestrianAtBeach(
  id: number,
  beachInfo: BeachTileInfo,
  grid: Tile[][],
  gridSize: number,
  homeX: number,
  homeY: number
): Pedestrian | null {
  // Find a road near the land tile adjacent to beach for path home
  const roadTile = findNearestRoadToBuilding(grid, gridSize, beachInfo.landX, beachInfo.landY);
  if (!roadTile) return null;
  
  // Find path home (for when they're done)
  const path = findPathOnRoads(grid, gridSize, roadTile.x, roadTile.y, homeX, homeY);
  if (!path || path.length === 0) return null;
  
  const ped = createPedestrian(
    id,
    homeX,
    homeY,
    beachInfo.landX,  // Destination is the land tile they'll return to
    beachInfo.landY,
    'beach',
    path,
    0,
    'south'
  );
  
  // Decide activity: swimming or lying on mat
  const isSwimming = Math.random() < PEDESTRIAN_BEACH_SWIM_CHANCE;
  
  ped.state = 'at_beach';
  ped.activity = isSwimming ? 'beach_swimming' : 'lying_on_mat';
  ped.activityProgress = Math.random() * 0.3; // Already partway through
  ped.activityDuration = PEDESTRIAN_BEACH_MIN_TIME +
    Math.random() * (PEDESTRIAN_BEACH_MAX_TIME - PEDESTRIAN_BEACH_MIN_TIME);
  
  // Store beach tile info
  ped.beachTileX = beachInfo.waterX;
  ped.beachTileY = beachInfo.waterY;
  ped.beachEdge = beachInfo.edge;
  
  // Position based on activity
  if (isSwimming) {
    // Swimmers are in the water, slightly away from shore
    // Random position within the water tile but biased toward the beach edge
    const offset = getRandomActivityOffset();
    ped.activityOffsetX = offset.x * 0.5; // Reduced randomness
    ped.activityOffsetY = offset.y * 0.5;
  } else {
    // Mat users are on the beach (on land tile)
    ped.hasBeachMat = true;
    // Position on the beach edge
    const offset = getRandomActivityOffset();
    ped.activityOffsetX = offset.x * 0.8;
    ped.activityOffsetY = offset.y * 0.4;
  }
  
  // Position at the beach water tile for swimmers, land tile for mat users
  if (isSwimming) {
    ped.tileX = beachInfo.waterX;
    ped.tileY = beachInfo.waterY;
  } else {
    ped.tileX = beachInfo.landX;
    ped.tileY = beachInfo.landY;
  }
  
  return ped;
}

/**
 * Check if a pedestrian is a beach-goer (for filtering in draw calls)
 */
export function isBeachPedestrian(ped: Pedestrian): boolean {
  return ped.state === 'at_beach';
}
