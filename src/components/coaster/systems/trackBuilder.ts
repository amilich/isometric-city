/**
 * Track Builder System - Handles coaster track placement and physics calculation
 */

import { 
  TrackPieceType, 
  TrackElement, 
  RideStats, 
  calculateTrackExcitement,
  calculateTrackIntensity,
  calculateTrackNausea,
  createEmptyStats,
} from '@/games/coaster/types/rides';
import { CoasterType } from '@/games/coaster/types/buildings';
import { TILE_WIDTH, TILE_HEIGHT } from './pathSystem';

// =============================================================================
// TRACK PIECE DEFINITIONS
// =============================================================================

export interface TrackPieceDefinition {
  type: TrackPieceType;
  name: string;
  cost: number;
  // Tile offsets from start (dx, dy, dHeight)
  segments: { dx: number; dy: number; dHeight: number }[];
  // Connection info
  entryDirection: 0 | 1 | 2 | 3; // N, E, S, W
  exitDirection: 0 | 1 | 2 | 3;
  // Physics
  excitement: number;
  intensity: number;
  nausea: number;
  // Special flags
  hasChainLift?: boolean;
  hasBooster?: boolean;
  hasBrakes?: boolean;
  isInversion?: boolean;
  isStation?: boolean;
}

export const TRACK_PIECES: Record<TrackPieceType, TrackPieceDefinition> = {
  // Flat pieces
  flat_straight: {
    type: 'flat_straight',
    name: 'Straight Track',
    cost: 200,
    segments: [{ dx: 1, dy: 0, dHeight: 0 }],
    entryDirection: 2,
    exitDirection: 0,
    excitement: 0.01,
    intensity: 0,
    nausea: 0,
  },
  flat_turn_left: {
    type: 'flat_turn_left',
    name: 'Left Turn',
    cost: 250,
    segments: [{ dx: 0, dy: -1, dHeight: 0 }],
    entryDirection: 2,
    exitDirection: 3,
    excitement: 0.02,
    intensity: 0.02,
    nausea: 0.01,
  },
  flat_turn_right: {
    type: 'flat_turn_right',
    name: 'Right Turn',
    cost: 250,
    segments: [{ dx: 0, dy: 1, dHeight: 0 }],
    entryDirection: 2,
    exitDirection: 1,
    excitement: 0.02,
    intensity: 0.02,
    nausea: 0.01,
  },
  flat_s_bend_left: {
    type: 'flat_s_bend_left',
    name: 'S-Bend Left',
    cost: 400,
    segments: [{ dx: 1, dy: -1, dHeight: 0 }, { dx: 2, dy: -1, dHeight: 0 }],
    entryDirection: 2,
    exitDirection: 0,
    excitement: 0.03,
    intensity: 0.02,
    nausea: 0.01,
  },
  flat_s_bend_right: {
    type: 'flat_s_bend_right',
    name: 'S-Bend Right',
    cost: 400,
    segments: [{ dx: 1, dy: 1, dHeight: 0 }, { dx: 2, dy: 1, dHeight: 0 }],
    entryDirection: 2,
    exitDirection: 0,
    excitement: 0.03,
    intensity: 0.02,
    nausea: 0.01,
  },

  // Slopes
  slope_up_25: {
    type: 'slope_up_25',
    name: 'Gentle Slope Up',
    cost: 300,
    segments: [{ dx: 1, dy: 0, dHeight: 2 }],
    entryDirection: 2,
    exitDirection: 0,
    excitement: 0.02,
    intensity: 0.01,
    nausea: 0,
  },
  slope_up_60: {
    type: 'slope_up_60',
    name: 'Steep Slope Up',
    cost: 500,
    segments: [{ dx: 1, dy: 0, dHeight: 4 }],
    entryDirection: 2,
    exitDirection: 0,
    excitement: 0.05,
    intensity: 0.05,
    nausea: 0.02,
  },
  slope_up_90: {
    type: 'slope_up_90',
    name: 'Vertical Climb',
    cost: 800,
    segments: [{ dx: 0, dy: 0, dHeight: 6 }],
    entryDirection: 2,
    exitDirection: 0,
    excitement: 0.1,
    intensity: 0.15,
    nausea: 0.05,
  },
  slope_down_25: {
    type: 'slope_down_25',
    name: 'Gentle Slope Down',
    cost: 300,
    segments: [{ dx: 1, dy: 0, dHeight: -2 }],
    entryDirection: 2,
    exitDirection: 0,
    excitement: 0.03,
    intensity: 0.02,
    nausea: 0,
  },
  slope_down_60: {
    type: 'slope_down_60',
    name: 'Steep Slope Down',
    cost: 500,
    segments: [{ dx: 1, dy: 0, dHeight: -4 }],
    entryDirection: 2,
    exitDirection: 0,
    excitement: 0.08,
    intensity: 0.1,
    nausea: 0.03,
  },
  slope_down_90: {
    type: 'slope_down_90',
    name: 'Vertical Drop',
    cost: 800,
    segments: [{ dx: 0, dy: 0, dHeight: -6 }],
    entryDirection: 2,
    exitDirection: 0,
    excitement: 0.15,
    intensity: 0.2,
    nausea: 0.08,
  },

  // Slope transitions
  flat_to_slope_up_25: {
    type: 'flat_to_slope_up_25',
    name: 'Flat to Gentle Up',
    cost: 350,
    segments: [{ dx: 1, dy: 0, dHeight: 1 }],
    entryDirection: 2,
    exitDirection: 0,
    excitement: 0.01,
    intensity: 0.01,
    nausea: 0,
  },
  slope_up_25_to_flat: {
    type: 'slope_up_25_to_flat',
    name: 'Gentle Up to Flat',
    cost: 350,
    segments: [{ dx: 1, dy: 0, dHeight: 1 }],
    entryDirection: 2,
    exitDirection: 0,
    excitement: 0.01,
    intensity: 0.01,
    nausea: 0,
  },
  slope_up_25_to_60: {
    type: 'slope_up_25_to_60',
    name: 'Gentle to Steep Up',
    cost: 450,
    segments: [{ dx: 1, dy: 0, dHeight: 3 }],
    entryDirection: 2,
    exitDirection: 0,
    excitement: 0.03,
    intensity: 0.03,
    nausea: 0.01,
  },
  slope_up_60_to_25: {
    type: 'slope_up_60_to_25',
    name: 'Steep to Gentle Up',
    cost: 450,
    segments: [{ dx: 1, dy: 0, dHeight: 3 }],
    entryDirection: 2,
    exitDirection: 0,
    excitement: 0.03,
    intensity: 0.03,
    nausea: 0.01,
  },
  flat_to_slope_down_25: {
    type: 'flat_to_slope_down_25',
    name: 'Flat to Gentle Down',
    cost: 350,
    segments: [{ dx: 1, dy: 0, dHeight: -1 }],
    entryDirection: 2,
    exitDirection: 0,
    excitement: 0.02,
    intensity: 0.01,
    nausea: 0,
  },
  slope_down_25_to_flat: {
    type: 'slope_down_25_to_flat',
    name: 'Gentle Down to Flat',
    cost: 350,
    segments: [{ dx: 1, dy: 0, dHeight: -1 }],
    entryDirection: 2,
    exitDirection: 0,
    excitement: 0.02,
    intensity: 0.02,
    nausea: 0.01,
  },

  // Banked turns
  banked_turn_left: {
    type: 'banked_turn_left',
    name: 'Banked Left Turn',
    cost: 350,
    segments: [{ dx: 0, dy: -1, dHeight: 0 }],
    entryDirection: 2,
    exitDirection: 3,
    excitement: 0.04,
    intensity: 0.03,
    nausea: 0.02,
  },
  banked_turn_right: {
    type: 'banked_turn_right',
    name: 'Banked Right Turn',
    cost: 350,
    segments: [{ dx: 0, dy: 1, dHeight: 0 }],
    entryDirection: 2,
    exitDirection: 1,
    excitement: 0.04,
    intensity: 0.03,
    nausea: 0.02,
  },
  banked_helix_left_small: {
    type: 'banked_helix_left_small',
    name: 'Small Helix Left',
    cost: 800,
    segments: [
      { dx: 0, dy: -1, dHeight: 2 },
      { dx: -1, dy: -1, dHeight: 4 },
      { dx: -1, dy: 0, dHeight: 6 },
    ],
    entryDirection: 2,
    exitDirection: 0,
    excitement: 0.15,
    intensity: 0.1,
    nausea: 0.08,
  },
  banked_helix_right_small: {
    type: 'banked_helix_right_small',
    name: 'Small Helix Right',
    cost: 800,
    segments: [
      { dx: 0, dy: 1, dHeight: 2 },
      { dx: -1, dy: 1, dHeight: 4 },
      { dx: -1, dy: 0, dHeight: 6 },
    ],
    entryDirection: 2,
    exitDirection: 0,
    excitement: 0.15,
    intensity: 0.1,
    nausea: 0.08,
  },
  banked_helix_left_large: {
    type: 'banked_helix_left_large',
    name: 'Large Helix Left',
    cost: 1200,
    segments: [
      { dx: 0, dy: -1, dHeight: 2 },
      { dx: -1, dy: -2, dHeight: 4 },
      { dx: -2, dy: -2, dHeight: 6 },
      { dx: -2, dy: -1, dHeight: 8 },
      { dx: -2, dy: 0, dHeight: 10 },
    ],
    entryDirection: 2,
    exitDirection: 0,
    excitement: 0.25,
    intensity: 0.15,
    nausea: 0.12,
  },
  banked_helix_right_large: {
    type: 'banked_helix_right_large',
    name: 'Large Helix Right',
    cost: 1200,
    segments: [
      { dx: 0, dy: 1, dHeight: 2 },
      { dx: -1, dy: 2, dHeight: 4 },
      { dx: -2, dy: 2, dHeight: 6 },
      { dx: -2, dy: 1, dHeight: 8 },
      { dx: -2, dy: 0, dHeight: 10 },
    ],
    entryDirection: 2,
    exitDirection: 0,
    excitement: 0.25,
    intensity: 0.15,
    nausea: 0.12,
  },

  // Special elements
  chain_lift: {
    type: 'chain_lift',
    name: 'Chain Lift',
    cost: 600,
    segments: [{ dx: 1, dy: 0, dHeight: 4 }],
    entryDirection: 2,
    exitDirection: 0,
    excitement: 0.05,
    intensity: 0.02,
    nausea: 0,
    hasChainLift: true,
  },
  station: {
    type: 'station',
    name: 'Station',
    cost: 1000,
    segments: [{ dx: 1, dy: 0, dHeight: 0 }],
    entryDirection: 2,
    exitDirection: 0,
    excitement: 0,
    intensity: 0,
    nausea: 0,
    isStation: true,
  },
  block_brakes: {
    type: 'block_brakes',
    name: 'Block Brakes',
    cost: 500,
    segments: [{ dx: 1, dy: 0, dHeight: 0 }],
    entryDirection: 2,
    exitDirection: 0,
    excitement: 0,
    intensity: 0,
    nausea: 0,
    hasBrakes: true,
  },
  brakes: {
    type: 'brakes',
    name: 'Brakes',
    cost: 300,
    segments: [{ dx: 1, dy: 0, dHeight: 0 }],
    entryDirection: 2,
    exitDirection: 0,
    excitement: 0,
    intensity: 0,
    nausea: 0,
    hasBrakes: true,
  },
  on_ride_photo: {
    type: 'on_ride_photo',
    name: 'On-Ride Photo',
    cost: 500,
    segments: [{ dx: 1, dy: 0, dHeight: 0 }],
    entryDirection: 2,
    exitDirection: 0,
    excitement: 0.02,
    intensity: 0,
    nausea: 0,
  },
  booster: {
    type: 'booster',
    name: 'Booster',
    cost: 800,
    segments: [{ dx: 1, dy: 0, dHeight: 0 }],
    entryDirection: 2,
    exitDirection: 0,
    excitement: 0.1,
    intensity: 0.05,
    nausea: 0.02,
    hasBooster: true,
  },

  // Inversions
  vertical_loop: {
    type: 'vertical_loop',
    name: 'Vertical Loop',
    cost: 2000,
    segments: [
      { dx: 1, dy: 0, dHeight: 4 },
      { dx: 2, dy: 0, dHeight: 8 },
      { dx: 3, dy: 0, dHeight: 4 },
      { dx: 4, dy: 0, dHeight: 0 },
    ],
    entryDirection: 2,
    exitDirection: 0,
    excitement: 0.5,
    intensity: 0.6,
    nausea: 0.4,
    isInversion: true,
  },
  corkscrew_left: {
    type: 'corkscrew_left',
    name: 'Corkscrew Left',
    cost: 1500,
    segments: [
      { dx: 1, dy: -1, dHeight: 2 },
      { dx: 2, dy: -1, dHeight: 0 },
    ],
    entryDirection: 2,
    exitDirection: 0,
    excitement: 0.4,
    intensity: 0.5,
    nausea: 0.5,
    isInversion: true,
  },
  corkscrew_right: {
    type: 'corkscrew_right',
    name: 'Corkscrew Right',
    cost: 1500,
    segments: [
      { dx: 1, dy: 1, dHeight: 2 },
      { dx: 2, dy: 1, dHeight: 0 },
    ],
    entryDirection: 2,
    exitDirection: 0,
    excitement: 0.4,
    intensity: 0.5,
    nausea: 0.5,
    isInversion: true,
  },
  barrel_roll_left: {
    type: 'barrel_roll_left',
    name: 'Barrel Roll Left',
    cost: 1800,
    segments: [
      { dx: 1, dy: 0, dHeight: 0 },
      { dx: 2, dy: 0, dHeight: 0 },
    ],
    entryDirection: 2,
    exitDirection: 0,
    excitement: 0.45,
    intensity: 0.55,
    nausea: 0.5,
    isInversion: true,
  },
  barrel_roll_right: {
    type: 'barrel_roll_right',
    name: 'Barrel Roll Right',
    cost: 1800,
    segments: [
      { dx: 1, dy: 0, dHeight: 0 },
      { dx: 2, dy: 0, dHeight: 0 },
    ],
    entryDirection: 2,
    exitDirection: 0,
    excitement: 0.45,
    intensity: 0.55,
    nausea: 0.5,
    isInversion: true,
  },
  half_loop_up: {
    type: 'half_loop_up',
    name: 'Half Loop Up',
    cost: 1200,
    segments: [
      { dx: 1, dy: 0, dHeight: 4 },
      { dx: 1, dy: 0, dHeight: 8 },
    ],
    entryDirection: 2,
    exitDirection: 0,
    excitement: 0.35,
    intensity: 0.45,
    nausea: 0.35,
    isInversion: true,
  },
  half_loop_down: {
    type: 'half_loop_down',
    name: 'Half Loop Down',
    cost: 1200,
    segments: [
      { dx: 1, dy: 0, dHeight: -4 },
      { dx: 1, dy: 0, dHeight: -8 },
    ],
    entryDirection: 2,
    exitDirection: 0,
    excitement: 0.4,
    intensity: 0.5,
    nausea: 0.4,
    isInversion: true,
  },
  cobra_roll: {
    type: 'cobra_roll',
    name: 'Cobra Roll',
    cost: 3000,
    segments: [
      { dx: 1, dy: 0, dHeight: 4 },
      { dx: 2, dy: 0, dHeight: 6 },
      { dx: 3, dy: 0, dHeight: 4 },
      { dx: 4, dy: 0, dHeight: 0 },
    ],
    entryDirection: 2,
    exitDirection: 0,
    excitement: 0.7,
    intensity: 0.8,
    nausea: 0.7,
    isInversion: true,
  },
  heartline_roll: {
    type: 'heartline_roll',
    name: 'Heartline Roll',
    cost: 2200,
    segments: [
      { dx: 1, dy: 0, dHeight: 0 },
      { dx: 2, dy: 0, dHeight: 0 },
    ],
    entryDirection: 2,
    exitDirection: 0,
    excitement: 0.5,
    intensity: 0.6,
    nausea: 0.6,
    isInversion: true,
  },
  zero_g_roll: {
    type: 'zero_g_roll',
    name: 'Zero-G Roll',
    cost: 2500,
    segments: [
      { dx: 1, dy: 0, dHeight: 2 },
      { dx: 2, dy: 0, dHeight: 0 },
    ],
    entryDirection: 2,
    exitDirection: 0,
    excitement: 0.6,
    intensity: 0.7,
    nausea: 0.5,
    isInversion: true,
  },
  inline_twist: {
    type: 'inline_twist',
    name: 'Inline Twist',
    cost: 1600,
    segments: [{ dx: 1, dy: 0, dHeight: 0 }],
    entryDirection: 2,
    exitDirection: 0,
    excitement: 0.35,
    intensity: 0.45,
    nausea: 0.45,
    isInversion: true,
  },

  // Drops
  vertical_drop: {
    type: 'vertical_drop',
    name: 'Vertical Drop',
    cost: 1500,
    segments: [{ dx: 0, dy: 0, dHeight: -10 }],
    entryDirection: 2,
    exitDirection: 0,
    excitement: 0.6,
    intensity: 0.8,
    nausea: 0.3,
  },
  beyond_vertical_drop: {
    type: 'beyond_vertical_drop',
    name: 'Beyond Vertical Drop',
    cost: 2000,
    segments: [
      { dx: -1, dy: 0, dHeight: -6 },
      { dx: -1, dy: 0, dHeight: -12 },
    ],
    entryDirection: 2,
    exitDirection: 2,
    excitement: 0.8,
    intensity: 1.0,
    nausea: 0.5,
  },
  dive_loop: {
    type: 'dive_loop',
    name: 'Dive Loop',
    cost: 2500,
    segments: [
      { dx: 1, dy: 0, dHeight: -4 },
      { dx: 2, dy: 1, dHeight: -8 },
      { dx: 3, dy: 1, dHeight: -4 },
    ],
    entryDirection: 2,
    exitDirection: 1,
    excitement: 0.55,
    intensity: 0.65,
    nausea: 0.45,
    isInversion: true,
  },
  immelmann: {
    type: 'immelmann',
    name: 'Immelmann',
    cost: 2500,
    segments: [
      { dx: 1, dy: 0, dHeight: 4 },
      { dx: 2, dy: -1, dHeight: 6 },
      { dx: 3, dy: -1, dHeight: 4 },
    ],
    entryDirection: 2,
    exitDirection: 3,
    excitement: 0.55,
    intensity: 0.65,
    nausea: 0.45,
    isInversion: true,
  },
};

// =============================================================================
// TRACK BUILDER FUNCTIONS
// =============================================================================

/**
 * Calculate the end position and direction of a track element
 */
export function calculateTrackEnd(
  element: TrackElement,
  pieceDef: TrackPieceDefinition
): { x: number; y: number; height: number; direction: 0 | 1 | 2 | 3 } {
  const lastSegment = pieceDef.segments[pieceDef.segments.length - 1];
  
  // Rotate based on direction
  let dx = lastSegment.dx;
  let dy = lastSegment.dy;
  
  for (let i = 0; i < element.direction; i++) {
    const temp = dx;
    dx = dy;
    dy = -temp;
  }
  
  const exitDir = (pieceDef.exitDirection + element.direction) % 4 as 0 | 1 | 2 | 3;
  
  return {
    x: element.x + dx,
    y: element.y + dy,
    height: element.height + lastSegment.dHeight,
    direction: exitDir,
  };
}

/**
 * Calculate ride stats from track layout
 */
export function calculateRideStats(
  track: TrackElement[],
  coasterType: CoasterType
): RideStats {
  const stats = createEmptyStats();

  if (track.length === 0) return stats;

  let totalExcitement = 0;
  let totalIntensity = 0;
  let totalNausea = 0;
  let maxHeight = 0;
  let minHeight = 255;
  let inversions = 0;
  let drops = 0;
  let highestDrop = 0;
  let prevHeight = track[0].height;

  for (const element of track) {
    const pieceDef = TRACK_PIECES[element.type];
    if (!pieceDef) continue;

    totalExcitement += pieceDef.excitement;
    totalIntensity += pieceDef.intensity;
    totalNausea += pieceDef.nausea;

    if (pieceDef.isInversion) {
      inversions++;
    }

    maxHeight = Math.max(maxHeight, element.height);
    minHeight = Math.min(minHeight, element.height);

    // Track drops
    if (element.height < prevHeight) {
      const dropHeight = prevHeight - element.height;
      if (dropHeight > 2) {
        drops++;
        highestDrop = Math.max(highestDrop, dropHeight);
      }
    }
    prevHeight = element.height;
  }

  // Base stats from coaster type
  stats.excitement = calculateTrackExcitement(track, coasterType) + totalExcitement;
  stats.intensity = calculateTrackIntensity(track, coasterType) + totalIntensity;
  stats.nausea = calculateTrackNausea(track, coasterType) + totalNausea;

  // Bonuses
  stats.excitement += (maxHeight - minHeight) * 0.03;
  stats.excitement += inversions * 0.2;
  stats.excitement += drops * 0.1;

  // Intensity penalties for too many inversions
  if (inversions > 8) {
    stats.nausea += (inversions - 8) * 0.3;
  }

  // Set other stats
  stats.inversions = inversions;
  stats.drops = drops;
  stats.highestDropHeight = highestDrop * 2; // Convert to meters
  stats.rideLength = track.length * 10; // Rough estimate in meters
  stats.rideTime = track.length * 3; // Rough estimate in seconds

  // Round to 2 decimal places
  stats.excitement = Math.round(stats.excitement * 100) / 100;
  stats.intensity = Math.round(stats.intensity * 100) / 100;
  stats.nausea = Math.round(stats.nausea * 100) / 100;

  return stats;
}

/**
 * Check if a track piece can be placed at a position
 */
export function canPlaceTrackPiece(
  track: TrackElement[],
  newPiece: TrackPieceType,
  x: number,
  y: number,
  height: number,
  direction: 0 | 1 | 2 | 3,
  gridSize: number
): { valid: boolean; error?: string } {
  const pieceDef = TRACK_PIECES[newPiece];
  if (!pieceDef) {
    return { valid: false, error: 'Invalid track piece type' };
  }

  // Check grid bounds
  for (const segment of pieceDef.segments) {
    let dx = segment.dx;
    let dy = segment.dy;
    
    // Rotate based on direction
    for (let i = 0; i < direction; i++) {
      const temp = dx;
      dx = dy;
      dy = -temp;
    }
    
    const nx = x + dx;
    const ny = y + dy;
    const nh = height + segment.dHeight;
    
    if (nx < 0 || nx >= gridSize || ny < 0 || ny >= gridSize) {
      return { valid: false, error: 'Track extends beyond map bounds' };
    }
    
    if (nh < 0) {
      return { valid: false, error: 'Track goes below ground level' };
    }
    
    if (nh > 60) {
      return { valid: false, error: 'Track is too high' };
    }
    
    // Check for collision with existing track
    const collision = track.find(t => t.x === nx && t.y === ny && Math.abs(t.height - nh) < 4);
    if (collision) {
      return { valid: false, error: 'Track collides with existing track' };
    }
  }

  // If track has pieces, check connection
  if (track.length > 0) {
    const lastPiece = track[track.length - 1];
    const lastDef = TRACK_PIECES[lastPiece.type];
    const endPos = calculateTrackEnd(lastPiece, lastDef);
    
    if (x !== endPos.x || y !== endPos.y) {
      return { valid: false, error: 'Track piece must connect to previous piece' };
    }
    
    if (Math.abs(height - endPos.height) > 4) {
      return { valid: false, error: 'Height change too sudden' };
    }
    
    // Check direction compatibility
    const expectedEntry = (pieceDef.entryDirection + direction) % 4;
    if (endPos.direction !== expectedEntry) {
      return { valid: false, error: 'Track direction does not match' };
    }
  }

  return { valid: true };
}

/**
 * Check if track forms a complete circuit
 */
export function isCircuitComplete(track: TrackElement[]): boolean {
  if (track.length < 4) return false;

  const firstPiece = track[0];
  const lastPiece = track[track.length - 1];
  const lastDef = TRACK_PIECES[lastPiece.type];
  const endPos = calculateTrackEnd(lastPiece, lastDef);

  // Check if end connects back to start
  return (
    endPos.x === firstPiece.x &&
    endPos.y === firstPiece.y &&
    endPos.height === firstPiece.height
  );
}

/**
 * Get list of valid next track pieces
 */
export function getValidNextPieces(
  track: TrackElement[],
  gridSize: number
): TrackPieceType[] {
  if (track.length === 0) {
    return ['station'];
  }

  const lastPiece = track[track.length - 1];
  const lastDef = TRACK_PIECES[lastPiece.type];
  const endPos = calculateTrackEnd(lastPiece, lastDef);

  const validPieces: TrackPieceType[] = [];

  for (const [type, def] of Object.entries(TRACK_PIECES)) {
    const result = canPlaceTrackPiece(
      track,
      type as TrackPieceType,
      endPos.x,
      endPos.y,
      endPos.height,
      endPos.direction,
      gridSize
    );
    
    if (result.valid) {
      validPieces.push(type as TrackPieceType);
    }
  }

  return validPieces;
}
