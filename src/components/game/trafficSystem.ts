/**
 * Traffic System - Sophisticated road network with traffic lights and merged roads
 * Handles avenue/highway detection, traffic light state, and road rendering
 */

import { Tile } from '@/types/game';
import { TILE_WIDTH, TILE_HEIGHT, CarDirection } from './types';
import { 
  TRAFFIC_LIGHT_MIN_ZOOM, 
  DIRECTION_ARROWS_MIN_ZOOM, 
  MEDIAN_PLANTS_MIN_ZOOM,
  LANE_MARKINGS_MEDIAN_MIN_ZOOM,
} from './constants';

// ============================================================================
// Types
// ============================================================================

/** Traffic light state */
export type TrafficLightState = 'green_ns' | 'yellow_ns' | 'green_ew' | 'yellow_ew';

/** Road type based on adjacent road analysis */
export type RoadType = 'single' | 'avenue' | 'highway';

/** Direction of a merged road segment */
export type RoadOrientation = 'ns' | 'ew' | 'intersection';

/** Merged road info for a tile */
export interface MergedRoadInfo {
  type: RoadType;
  orientation: RoadOrientation;
  laneCount: number; // 1-4 depending on merge
  hasMedian: boolean;
  medianType: 'none' | 'line' | 'plants' | 'barrier';
  // Position within merged road (0 = leftmost/top, increasing to right/bottom)
  positionInMerge: number;
  mergeWidth: number; // Total tiles in this merged section
  // Which side of the road this tile represents (for proper lane directions)
  side: 'left' | 'right' | 'center' | 'single';
}

/** Traffic light at an intersection */
export interface TrafficLight {
  tileX: number;
  tileY: number;
  state: TrafficLightState;
  timer: number;
  isIntersection: boolean;
  // Which directions have roads
  hasNorth: boolean;
  hasEast: boolean;
  hasSouth: boolean;
  hasWest: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/** Traffic light timing (in seconds) */
export const TRAFFIC_LIGHT_TIMING = {
  GREEN_DURATION: 3.0,    // Time for green light (faster cycle)
  YELLOW_DURATION: 0.8,   // Time for yellow light
  TOTAL_CYCLE: 7.6,       // Full cycle time (2 green + 2 yellow)
};

/** Road rendering constants */
export const ROAD_CONFIG = {
  SINGLE_LANE_WIDTH: 0.14,   // Width ratio for single lane
  AVENUE_LANE_WIDTH: 0.11,   // Narrower lanes for avenues
  HIGHWAY_LANE_WIDTH: 0.10,  // Even narrower for highways
  MEDIAN_WIDTH: 0.08,        // Width of center median
  SIDEWALK_WIDTH: 0.08,      // Sidewalk width ratio
};

/** Colors for road rendering */
export const ROAD_COLORS = {
  ASPHALT: '#4a4a4a',
  ASPHALT_DARK: '#3a3a3a',
  ASPHALT_LIGHT: '#5a5a5a',
  LANE_MARKING: '#ffffff',
  CENTER_LINE: '#fbbf24',      // Yellow center line
  MEDIAN_CONCRETE: '#9ca3af',
  MEDIAN_PLANTS: '#4a7c3f',
  SIDEWALK: '#9ca3af',
  CURB: '#6b7280',
  TRAFFIC_LIGHT_POLE: '#374151',
  TRAFFIC_LIGHT_RED: '#ef4444',
  TRAFFIC_LIGHT_YELLOW: '#fbbf24',
  TRAFFIC_LIGHT_GREEN: '#22c55e',
  TRAFFIC_LIGHT_OFF: '#1f2937',
};

// ============================================================================
// Road Analysis Functions
// ============================================================================

/**
 * Check if a tile is a road or road bridge (not rail bridge)
 */
function isRoad(grid: Tile[][], gridSize: number, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) return false;
  const tile = grid[y][x];
  const type = tile.building.type;
  // Road bridges are valid, rail bridges are not
  if (type === 'bridge') {
    return tile.building.bridgeTrackType !== 'rail';
  }
  return type === 'road';
}

/**
 * Get adjacent road info for a tile
 */
export function getAdjacentRoads(
  grid: Tile[][],
  gridSize: number,
  x: number,
  y: number
): { north: boolean; east: boolean; south: boolean; west: boolean } {
  return {
    north: isRoad(grid, gridSize, x - 1, y),
    east: isRoad(grid, gridSize, x, y - 1),
    south: isRoad(grid, gridSize, x + 1, y),
    west: isRoad(grid, gridSize, x, y + 1),
  };
}

/**
 * Check if a tile is part of a parallel road group (potential avenue/highway)
 * Returns info about the merged road configuration
 */
export function analyzeMergedRoad(
  grid: Tile[][],
  gridSize: number,
  x: number,
  y: number
): MergedRoadInfo {
  if (!isRoad(grid, gridSize, x, y)) {
    return {
      type: 'single',
      orientation: 'intersection',
      laneCount: 1,
      hasMedian: false,
      medianType: 'none',
      positionInMerge: 0,
      mergeWidth: 1,
      side: 'single',
    };
  }

  const adj = getAdjacentRoads(grid, gridSize, x, y);
  
  // Count connections - intersection detection
  const connectionCount = [adj.north, adj.east, adj.south, adj.west].filter(Boolean).length;
  
  // Check for parallel roads in each perpendicular direction
  // For a road running NS (north-south), check for parallel roads to E and W
  // For a road running EW (east-west), check for parallel roads to N and S
  
  const isNSRoad = adj.north || adj.south;
  const isEWRoad = adj.east || adj.west;
  
  // If this is an intersection (3+ connections), don't merge
  if (connectionCount >= 3) {
    return {
      type: 'single',
      orientation: 'intersection',
      laneCount: 2,
      hasMedian: false,
      medianType: 'none',
      positionInMerge: 0,
      mergeWidth: 1,
      side: 'center',
    };
  }
  
  // Analyze parallel roads
  let parallelCount = 0;
  let positionInMerge = 0;
  let side: 'left' | 'right' | 'center' | 'single' = 'single';
  
  if (isNSRoad && !isEWRoad) {
    // Road runs north-south, check east-west for parallel roads
    // Check west (gridY+1) and east (gridY-1) for parallel NS roads
    const hasParallelWest = isRoad(grid, gridSize, x, y + 1) && 
      (isRoad(grid, gridSize, x - 1, y + 1) || isRoad(grid, gridSize, x + 1, y + 1));
    const hasParallelEast = isRoad(grid, gridSize, x, y - 1) && 
      (isRoad(grid, gridSize, x - 1, y - 1) || isRoad(grid, gridSize, x + 1, y - 1));
    
    // Count how many parallel roads exist in a row
    let westCount = 0;
    let eastCount = 0;
    
    // Count westward parallel NS roads
    for (let dy = 1; dy <= 3; dy++) {
      if (isRoad(grid, gridSize, x, y + dy)) {
        const parallelAdj = getAdjacentRoads(grid, gridSize, x, y + dy);
        if (parallelAdj.north || parallelAdj.south) {
          westCount++;
        } else break;
      } else break;
    }
    
    // Count eastward parallel NS roads
    for (let dy = 1; dy <= 3; dy++) {
      if (isRoad(grid, gridSize, x, y - dy)) {
        const parallelAdj = getAdjacentRoads(grid, gridSize, x, y - dy);
        if (parallelAdj.north || parallelAdj.south) {
          eastCount++;
        } else break;
      } else break;
    }
    
    parallelCount = westCount + eastCount + 1;
    positionInMerge = eastCount; // Position from the east side
    
    // Determine side based on position
    if (parallelCount > 1) {
      if (positionInMerge === 0) side = 'right';
      else if (positionInMerge === parallelCount - 1) side = 'left';
      else side = 'center';
    }
    
    // Determine road type
    const roadType = parallelCount >= 4 ? 'highway' : parallelCount >= 2 ? 'avenue' : 'single';
    
    return {
      type: roadType,
      orientation: 'ns',
      laneCount: Math.min(parallelCount * 2, 6),
      hasMedian: parallelCount >= 2,
      medianType: parallelCount >= 3 ? 'plants' : parallelCount >= 2 ? 'line' : 'none',
      positionInMerge,
      mergeWidth: parallelCount,
      side,
    };
  }
  
  if (isEWRoad && !isNSRoad) {
    // Road runs east-west, check north-south for parallel roads
    const hasParallelNorth = isRoad(grid, gridSize, x - 1, y) && 
      (isRoad(grid, gridSize, x - 1, y - 1) || isRoad(grid, gridSize, x - 1, y + 1));
    const hasParallelSouth = isRoad(grid, gridSize, x + 1, y) && 
      (isRoad(grid, gridSize, x + 1, y - 1) || isRoad(grid, gridSize, x + 1, y + 1));
    
    // Count how many parallel roads exist
    let northCount = 0;
    let southCount = 0;
    
    // Count northward parallel EW roads
    for (let dx = 1; dx <= 3; dx++) {
      if (isRoad(grid, gridSize, x - dx, y)) {
        const parallelAdj = getAdjacentRoads(grid, gridSize, x - dx, y);
        if (parallelAdj.east || parallelAdj.west) {
          northCount++;
        } else break;
      } else break;
    }
    
    // Count southward parallel EW roads
    for (let dx = 1; dx <= 3; dx++) {
      if (isRoad(grid, gridSize, x + dx, y)) {
        const parallelAdj = getAdjacentRoads(grid, gridSize, x + dx, y);
        if (parallelAdj.east || parallelAdj.west) {
          southCount++;
        } else break;
      } else break;
    }
    
    parallelCount = northCount + southCount + 1;
    positionInMerge = northCount; // Position from the north side
    
    // Determine side based on position
    if (parallelCount > 1) {
      if (positionInMerge === 0) side = 'left';
      else if (positionInMerge === parallelCount - 1) side = 'right';
      else side = 'center';
    }
    
    // Determine road type
    const roadType = parallelCount >= 4 ? 'highway' : parallelCount >= 2 ? 'avenue' : 'single';
    
    return {
      type: roadType,
      orientation: 'ew',
      laneCount: Math.min(parallelCount * 2, 6),
      hasMedian: parallelCount >= 2,
      medianType: parallelCount >= 3 ? 'plants' : parallelCount >= 2 ? 'line' : 'none',
      positionInMerge,
      mergeWidth: parallelCount,
      side,
    };
  }
  
  // Default single road
  return {
    type: 'single',
    orientation: connectionCount >= 2 ? 'intersection' : 'ns',
    laneCount: 1,
    hasMedian: false,
    medianType: 'none',
    positionInMerge: 0,
    mergeWidth: 1,
    side: 'single',
  };
}

/**
 * Determine if an intersection should have traffic lights
 * Traffic lights are placed at 3+ way intersections
 */
export function shouldHaveTrafficLight(
  grid: Tile[][],
  gridSize: number,
  x: number,
  y: number
): boolean {
  if (!isRoad(grid, gridSize, x, y)) return false;
  
  const adj = getAdjacentRoads(grid, gridSize, x, y);
  const connectionCount = [adj.north, adj.east, adj.south, adj.west].filter(Boolean).length;
  
  // Traffic lights at 3+ way intersections
  return connectionCount >= 3;
}

/**
 * Calculate traffic light state based on time
 */
export function getTrafficLightState(time: number): TrafficLightState {
  const cycleTime = time % TRAFFIC_LIGHT_TIMING.TOTAL_CYCLE;
  
  if (cycleTime < TRAFFIC_LIGHT_TIMING.GREEN_DURATION) {
    return 'green_ns'; // North-South green
  } else if (cycleTime < TRAFFIC_LIGHT_TIMING.GREEN_DURATION + TRAFFIC_LIGHT_TIMING.YELLOW_DURATION) {
    return 'yellow_ns'; // North-South yellow
  } else if (cycleTime < TRAFFIC_LIGHT_TIMING.GREEN_DURATION * 2 + TRAFFIC_LIGHT_TIMING.YELLOW_DURATION) {
    return 'green_ew'; // East-West green
  } else {
    return 'yellow_ew'; // East-West yellow
  }
}

/**
 * Check if a vehicle can proceed through an intersection
 */
export function canProceedThroughIntersection(
  direction: CarDirection,
  lightState: TrafficLightState
): boolean {
  // North and South directions can go on green_ns or yellow_ns
  if (direction === 'north' || direction === 'south') {
    return lightState === 'green_ns' || lightState === 'yellow_ns';
  }
  // East and West directions can go on green_ew or yellow_ew
  return lightState === 'green_ew' || lightState === 'yellow_ew';
}

// ============================================================================
// Road Drawing Functions
// ============================================================================

/**
 * Draw a traffic light at an intersection
 */
export function drawTrafficLight(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  lightState: TrafficLightState,
  position: 'nw' | 'ne' | 'sw' | 'se', // Corner position
  zoom: number
): void {
  // Only draw when zoomed in enough
  if (zoom < 0.6) return;
  
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  
  // Position traffic lights on outer edges near sidewalks (corners of the diamond)
  // These positions are at the actual tile corners where sidewalks would be
  const offsets = {
    nw: { x: w * 0.08, y: h * 0.42 },  // Near left corner
    ne: { x: w * 0.5, y: h * 0.08 },   // Near top corner
    sw: { x: w * 0.5, y: h * 0.92 },   // Near bottom corner
    se: { x: w * 0.92, y: h * 0.58 },  // Near right corner
  };
  
  const offset = offsets[position];
  const lightX = x + offset.x;
  const lightY = y + offset.y;
  
  // Smaller, more subtle traffic lights
  const poleHeight = 6 * (zoom > 0.8 ? 1 : 0.8);
  const lightSize = 1.5 * (zoom > 0.8 ? 1 : 0.8);
  
  // Draw pole (simple vertical line)
  ctx.strokeStyle = ROAD_COLORS.TRAFFIC_LIGHT_POLE;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(lightX, lightY);
  ctx.lineTo(lightX, lightY - poleHeight);
  ctx.stroke();
  
  // Draw light housing (small rectangle)
  const housingWidth = lightSize * 2;
  const housingHeight = lightSize * 4;
  
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(
    lightX - housingWidth / 2,
    lightY - poleHeight - housingHeight,
    housingWidth,
    housingHeight
  );
  
  // Determine which light to show based on position and state
  // NW and SE positions show NS lights, NE and SW show EW lights
  const isNSPosition = position === 'nw' || position === 'se';
  
  let redOn = false;
  let yellowOn = false;
  let greenOn = false;
  
  if (isNSPosition) {
    // This light controls NS traffic
    if (lightState === 'green_ns') greenOn = true;
    else if (lightState === 'yellow_ns') yellowOn = true;
    else redOn = true;
  } else {
    // This light controls EW traffic
    if (lightState === 'green_ew') greenOn = true;
    else if (lightState === 'yellow_ew') yellowOn = true;
    else redOn = true;
  }
  
  // Draw the three lights
  const lightSpacing = lightSize * 1.2;
  const baseY = lightY - poleHeight - housingHeight + lightSize * 0.8;
  
  // Red light (top)
  ctx.fillStyle = redOn ? ROAD_COLORS.TRAFFIC_LIGHT_RED : ROAD_COLORS.TRAFFIC_LIGHT_OFF;
  ctx.beginPath();
  ctx.arc(lightX, baseY, lightSize * 0.6, 0, Math.PI * 2);
  ctx.fill();
  
  // Add glow effect when on
  if (redOn) {
    ctx.shadowColor = ROAD_COLORS.TRAFFIC_LIGHT_RED;
    ctx.shadowBlur = 2;
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  
  // Yellow light (middle)
  ctx.fillStyle = yellowOn ? ROAD_COLORS.TRAFFIC_LIGHT_YELLOW : ROAD_COLORS.TRAFFIC_LIGHT_OFF;
  ctx.beginPath();
  ctx.arc(lightX, baseY + lightSpacing, lightSize * 0.6, 0, Math.PI * 2);
  ctx.fill();
  
  if (yellowOn) {
    ctx.shadowColor = ROAD_COLORS.TRAFFIC_LIGHT_YELLOW;
    ctx.shadowBlur = 2;
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  
  // Green light (bottom)
  ctx.fillStyle = greenOn ? ROAD_COLORS.TRAFFIC_LIGHT_GREEN : ROAD_COLORS.TRAFFIC_LIGHT_OFF;
  ctx.beginPath();
  ctx.arc(lightX, baseY + lightSpacing * 2, lightSize * 0.6, 0, Math.PI * 2);
  ctx.fill();
  
  if (greenOn) {
    ctx.shadowColor = ROAD_COLORS.TRAFFIC_LIGHT_GREEN;
    ctx.shadowBlur = 2;
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

/**
 * Draw avenue/highway median with optional plants or barriers
 */
export function drawMedian(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  medianType: 'line' | 'plants' | 'barrier',
  zoom: number
): void {
  const medianWidth = TILE_WIDTH * 0.04;
  
  if (medianType === 'line') {
    // Double yellow line
    ctx.strokeStyle = ROAD_COLORS.CENTER_LINE;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    
    // Calculate perpendicular offset
    const dx = endX - startX;
    const dy = endY - startY;
    const len = Math.hypot(dx, dy);
    const perpX = -dy / len * 2;
    const perpY = dx / len * 2;
    
    ctx.beginPath();
    ctx.moveTo(startX + perpX, startY + perpY);
    ctx.lineTo(endX + perpX, endY + perpY);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(startX - perpX, startY - perpY);
    ctx.lineTo(endX - perpX, endY - perpY);
    ctx.stroke();
  } else if (medianType === 'plants') {
    // Raised median with plants
    ctx.fillStyle = ROAD_COLORS.MEDIAN_CONCRETE;
    ctx.strokeStyle = ROAD_COLORS.CURB;
    ctx.lineWidth = 1;
    
    // Draw concrete base
    const dx = endX - startX;
    const dy = endY - startY;
    const len = Math.hypot(dx, dy);
    const perpX = -dy / len * medianWidth;
    const perpY = dx / len * medianWidth;
    
    ctx.beginPath();
    ctx.moveTo(startX + perpX, startY + perpY);
    ctx.lineTo(endX + perpX, endY + perpY);
    ctx.lineTo(endX - perpX, endY - perpY);
    ctx.lineTo(startX - perpX, startY - perpY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    // Draw plants/trees at intervals
    if (zoom >= MEDIAN_PLANTS_MIN_ZOOM) {
      const plantSpacing = 8;
      const numPlants = Math.floor(len / plantSpacing);
      
      ctx.fillStyle = ROAD_COLORS.MEDIAN_PLANTS;
      for (let i = 1; i < numPlants; i++) {
        const t = i / numPlants;
        const px = startX + dx * t;
        const py = startY + dy * t;
        
        // Simple circular bush
        ctx.beginPath();
        ctx.arc(px, py - 2, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (medianType === 'barrier') {
    // Concrete barrier (for highways)
    ctx.fillStyle = ROAD_COLORS.MEDIAN_CONCRETE;
    ctx.strokeStyle = ROAD_COLORS.CURB;
    ctx.lineWidth = 1;
    
    const dx = endX - startX;
    const dy = endY - startY;
    const len = Math.hypot(dx, dy);
    const perpX = -dy / len * medianWidth * 0.6;
    const perpY = dx / len * medianWidth * 0.6;
    
    ctx.beginPath();
    ctx.moveTo(startX + perpX, startY + perpY);
    ctx.lineTo(endX + perpX, endY + perpY);
    ctx.lineTo(endX - perpX, endY - perpY);
    ctx.lineTo(startX - perpX, startY - perpY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

/**
 * Draw lane markings (white dashed or solid)
 */
export function drawLaneMarkings(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  isSolid: boolean = false
): void {
  ctx.strokeStyle = ROAD_COLORS.LANE_MARKING;
  ctx.lineWidth = 0.8;
  
  if (isSolid) {
    ctx.setLineDash([]);
  } else {
    ctx.setLineDash([3, 4]);
  }
  
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();
  
  ctx.setLineDash([]);
}

/**
 * Draw directional arrow on road surface
 */
export function drawRoadArrow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  direction: 'north' | 'south' | 'east' | 'west',
  zoom: number
): void {
  if (zoom < 0.8) return; // Only show when zoomed in
  
  ctx.save();
  ctx.translate(x, y);
  
  // Rotate based on direction
  const rotations = {
    north: -Math.PI * 0.75,  // Top-left
    east: -Math.PI * 0.25,   // Top-right
    south: Math.PI * 0.25,   // Bottom-right
    west: Math.PI * 0.75,    // Bottom-left
  };
  ctx.rotate(rotations[direction]);
  
  // Draw arrow
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.beginPath();
  ctx.moveTo(0, -5);
  ctx.lineTo(3, 0);
  ctx.lineTo(1, 0);
  ctx.lineTo(1, 5);
  ctx.lineTo(-1, 5);
  ctx.lineTo(-1, 0);
  ctx.lineTo(-3, 0);
  ctx.closePath();
  ctx.fill();
  
  ctx.restore();
}

/**
 * Get the expected traffic flow direction for a road tile based on its position in a merged road
 */
export function getTrafficFlowDirection(
  mergeInfo: MergedRoadInfo
): CarDirection[] {
  if (mergeInfo.type === 'single') {
    // Single roads are bidirectional
    if (mergeInfo.orientation === 'ns') return ['north', 'south'];
    if (mergeInfo.orientation === 'ew') return ['east', 'west'];
    return ['north', 'south', 'east', 'west'];
  }
  
  // For merged roads, direction depends on which side of the road
  if (mergeInfo.orientation === 'ns') {
    // In NS roads: right side goes north, left side goes south (driving on right)
    if (mergeInfo.side === 'right') return ['north'];
    if (mergeInfo.side === 'left') return ['south'];
    return ['north', 'south']; // Center handles both
  }
  
  if (mergeInfo.orientation === 'ew') {
    // In EW roads: right side goes east, left side goes west
    if (mergeInfo.side === 'right') return ['east'];
    if (mergeInfo.side === 'left') return ['west'];
    return ['east', 'west'];
  }
  
  return ['north', 'south', 'east', 'west'];
}

// ============================================================================
// Main Road Drawing Function for Merged Roads
// ============================================================================

/**
 * Draw a merged road segment (avenue or highway)
 */
export function drawMergedRoadSegment(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  mergeInfo: MergedRoadInfo,
  adj: { north: boolean; east: boolean; south: boolean; west: boolean },
  trafficLightTime: number,
  zoom: number
): void {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = x + w / 2;
  const cy = y + h / 2;
  
  // Diamond corner points
  const topCorner = { x: x + w / 2, y: y };
  const rightCorner = { x: x + w, y: y + h / 2 };
  const bottomCorner = { x: x + w / 2, y: y + h };
  const leftCorner = { x: x, y: y + h / 2 };
  
  // Edge midpoints
  const northEdgeX = x + w * 0.25;
  const northEdgeY = y + h * 0.25;
  const eastEdgeX = x + w * 0.75;
  const eastEdgeY = y + h * 0.25;
  const southEdgeX = x + w * 0.75;
  const southEdgeY = y + h * 0.75;
  const westEdgeX = x + w * 0.25;
  const westEdgeY = y + h * 0.75;
  
  // Road segment width based on type
  const laneWidth = mergeInfo.type === 'highway' ? ROAD_CONFIG.HIGHWAY_LANE_WIDTH :
                    mergeInfo.type === 'avenue' ? ROAD_CONFIG.AVENUE_LANE_WIDTH :
                    ROAD_CONFIG.SINGLE_LANE_WIDTH;
  const roadW = w * laneWidth * 2;
  
  // Draw sidewalks on outer edges only (not between merged road segments)
  const drawSidewalks = mergeInfo.side === 'left' || mergeInfo.side === 'right' || mergeInfo.side === 'single';
  
  if (drawSidewalks) {
    // Only draw sidewalk on the outer edge of merged roads
    const sidewalkWidth = w * ROAD_CONFIG.SIDEWALK_WIDTH;
    ctx.fillStyle = ROAD_COLORS.SIDEWALK;
    ctx.strokeStyle = ROAD_COLORS.CURB;
    ctx.lineWidth = 1;
    
    if (mergeInfo.orientation === 'ns') {
      // NS road - draw sidewalks on east/west edges if this is an outer tile
      if (mergeInfo.side === 'right' && !adj.east) {
        // East sidewalk (top-right edge)
        ctx.beginPath();
        ctx.moveTo(topCorner.x, topCorner.y);
        ctx.lineTo(rightCorner.x, rightCorner.y);
        ctx.lineTo(rightCorner.x - sidewalkWidth * 0.707, rightCorner.y + sidewalkWidth * 0.707);
        ctx.lineTo(topCorner.x - sidewalkWidth * 0.707, topCorner.y + sidewalkWidth * 0.707);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      if (mergeInfo.side === 'left' && !adj.west) {
        // West sidewalk (bottom-left edge)
        ctx.beginPath();
        ctx.moveTo(bottomCorner.x, bottomCorner.y);
        ctx.lineTo(leftCorner.x, leftCorner.y);
        ctx.lineTo(leftCorner.x + sidewalkWidth * 0.707, leftCorner.y - sidewalkWidth * 0.707);
        ctx.lineTo(bottomCorner.x + sidewalkWidth * 0.707, bottomCorner.y - sidewalkWidth * 0.707);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    } else if (mergeInfo.orientation === 'ew') {
      // EW road - draw sidewalks on north/south edges if this is an outer tile
      if (mergeInfo.side === 'left' && !adj.north) {
        // North sidewalk (top-left edge)
        ctx.beginPath();
        ctx.moveTo(leftCorner.x, leftCorner.y);
        ctx.lineTo(topCorner.x, topCorner.y);
        ctx.lineTo(topCorner.x + sidewalkWidth * 0.707, topCorner.y + sidewalkWidth * 0.707);
        ctx.lineTo(leftCorner.x + sidewalkWidth * 0.707, leftCorner.y + sidewalkWidth * 0.707);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      if (mergeInfo.side === 'right' && !adj.south) {
        // South sidewalk (bottom-right edge)
        ctx.beginPath();
        ctx.moveTo(rightCorner.x, rightCorner.y);
        ctx.lineTo(bottomCorner.x, bottomCorner.y);
        ctx.lineTo(bottomCorner.x - sidewalkWidth * 0.707, bottomCorner.y - sidewalkWidth * 0.707);
        ctx.lineTo(rightCorner.x - sidewalkWidth * 0.707, rightCorner.y - sidewalkWidth * 0.707);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }
  }
  
  // Draw the main road surface
  ctx.fillStyle = ROAD_COLORS.ASPHALT;
  ctx.beginPath();
  ctx.moveTo(topCorner.x, topCorner.y);
  ctx.lineTo(rightCorner.x, rightCorner.y);
  ctx.lineTo(bottomCorner.x, bottomCorner.y);
  ctx.lineTo(leftCorner.x, leftCorner.y);
  ctx.closePath();
  ctx.fill();
  
  // Draw lane markings based on road type
  if (zoom >= LANE_MARKINGS_MEDIAN_MIN_ZOOM) {
    if (mergeInfo.type !== 'single' && mergeInfo.hasMedian) {
      // Draw median for avenues/highways
      if (mergeInfo.side === 'center' || 
          (mergeInfo.mergeWidth === 2 && mergeInfo.positionInMerge === 0)) {
        // Draw median on the boundary between lanes
        if (mergeInfo.orientation === 'ns') {
          // Median runs NS (perpendicular to tile boundary)
          // Draw on the east edge if this is the left tile of a pair
          if (mergeInfo.positionInMerge === Math.floor(mergeInfo.mergeWidth / 2) - 1) {
            const medianType = mergeInfo.medianType === 'none' ? 'line' : mergeInfo.medianType;
            drawMedian(ctx, northEdgeX, northEdgeY, southEdgeX, southEdgeY, medianType, zoom);
          }
        } else {
          // Median runs EW
          if (mergeInfo.positionInMerge === Math.floor(mergeInfo.mergeWidth / 2) - 1) {
            const medianType = mergeInfo.medianType === 'none' ? 'line' : mergeInfo.medianType;
            drawMedian(ctx, eastEdgeX, eastEdgeY, westEdgeX, westEdgeY, medianType, zoom);
          }
        }
      }
    }
    
    // Draw direction arrows
    if (zoom >= DIRECTION_ARROWS_MIN_ZOOM && mergeInfo.type !== 'single') {
      const flowDirs = getTrafficFlowDirection(mergeInfo);
      if (flowDirs.length === 1) {
        drawRoadArrow(ctx, cx, cy, flowDirs[0], zoom);
      }
    }
    
    // Draw center line for single roads
    if (mergeInfo.type === 'single') {
      ctx.strokeStyle = ROAD_COLORS.CENTER_LINE;
      ctx.lineWidth = 0.8;
      ctx.setLineDash([1.5, 2]);
      
      if (adj.north) {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(northEdgeX, northEdgeY);
        ctx.stroke();
      }
      if (adj.east) {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(eastEdgeX, eastEdgeY);
        ctx.stroke();
      }
      if (adj.south) {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(southEdgeX, southEdgeY);
        ctx.stroke();
      }
      if (adj.west) {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(westEdgeX, westEdgeY);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
  }
  
  // Draw traffic lights at intersections
  const connectionCount = [adj.north, adj.east, adj.south, adj.west].filter(Boolean).length;
  if (connectionCount >= 3 && zoom >= TRAFFIC_LIGHT_MIN_ZOOM) {
    const lightState = getTrafficLightState(trafficLightTime);
    
    // Draw traffic lights at appropriate corners based on which roads exist
    if (adj.north && adj.east) {
      drawTrafficLight(ctx, x, y, lightState, 'ne', zoom);
    }
    if (adj.north && adj.west) {
      drawTrafficLight(ctx, x, y, lightState, 'nw', zoom);
    }
    if (adj.south && adj.east) {
      drawTrafficLight(ctx, x, y, lightState, 'se', zoom);
    }
    if (adj.south && adj.west) {
      drawTrafficLight(ctx, x, y, lightState, 'sw', zoom);
    }
  }
}

// ============================================================================
// Crosswalk Drawing
// ============================================================================

export interface CrosswalkParams {
  ctx: CanvasRenderingContext2D;
  x: number;  // Screen x of tile top-left
  y: number;  // Screen y of tile top-left
  gridX: number;
  gridY: number;
  zoom: number;
  roadW: number;  // Road width (varies by road type)
  adj: { north: boolean; east: boolean; south: boolean; west: boolean };
  hasRoad: (gx: number, gy: number) => boolean;
}

/**
 * Draw crosswalks on tiles adjacent to intersections
 * Stripes run PARALLEL to traffic, spaced ACROSS the road width
 */
export function drawCrosswalks(params: CrosswalkParams): void {
  const { ctx, x, y, gridX, gridY, zoom, roadW, adj, hasRoad } = params;
  
  if (zoom < 0.75) return;
  
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = x + w / 2;
  const cy = y + h / 2;
  
  // Tile corner positions
  const topCorner = { x: cx, y: y };
  const rightCorner = { x: x + w, y: cy };
  const bottomCorner = { x: cx, y: y + h };
  const leftCorner = { x: x, y: cy };
  
  // Edge midpoints (where roads connect)
  const northEdgeX = x + w * 0.25;
  const northEdgeY = y + h * 0.25;
  const eastEdgeX = x + w * 0.75;
  const eastEdgeY = y + h * 0.25;
  const southEdgeX = x + w * 0.75;
  const southEdgeY = y + h * 0.75;
  const westEdgeX = x + w * 0.25;
  const westEdgeY = y + h * 0.75;
  
  // Direction vectors from center to edges
  const northDx = (northEdgeX - cx) / Math.hypot(northEdgeX - cx, northEdgeY - cy);
  const northDy = (northEdgeY - cy) / Math.hypot(northEdgeX - cx, northEdgeY - cy);
  const eastDx = (eastEdgeX - cx) / Math.hypot(eastEdgeX - cx, eastEdgeY - cy);
  const eastDy = (eastEdgeY - cy) / Math.hypot(eastEdgeX - cx, eastEdgeY - cy);
  const southDx = (southEdgeX - cx) / Math.hypot(southEdgeX - cx, southEdgeY - cy);
  const southDy = (southEdgeY - cy) / Math.hypot(southEdgeX - cx, southEdgeY - cy);
  const westDx = (westEdgeX - cx) / Math.hypot(westEdgeX - cx, westEdgeY - cy);
  const westDy = (westEdgeY - cy) / Math.hypot(westEdgeX - cx, westEdgeY - cy);
  
  // Helper to check if adjacent tile is an intersection
  const isAdjacentIntersection = (adjX: number, adjY: number): boolean => {
    if (!hasRoad(adjX, adjY)) return false;
    const adjNorth = hasRoad(adjX - 1, adjY);
    const adjEast = hasRoad(adjX, adjY - 1);
    const adjSouth = hasRoad(adjX + 1, adjY);
    const adjWest = hasRoad(adjX, adjY + 1);
    return [adjNorth, adjEast, adjSouth, adjWest].filter(Boolean).length >= 3;
  };
  
  const northAdj = adj.north && isAdjacentIntersection(gridX - 1, gridY);
  const eastAdj = adj.east && isAdjacentIntersection(gridX, gridY - 1);
  const southAdj = adj.south && isAdjacentIntersection(gridX + 1, gridY);
  const westAdj = adj.west && isAdjacentIntersection(gridX, gridY + 1);
  
  if (!northAdj && !eastAdj && !southAdj && !westAdj) return;
  
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 0.7;
  ctx.setLineDash([]);
  
  // Tile edge directions for perpendicular spacing
  const nwDx = topCorner.x - leftCorner.x;
  const nwDy = topCorner.y - leftCorner.y;
  const nwLen = Math.hypot(nwDx, nwDy);
  const neDx = rightCorner.x - topCorner.x;
  const neDy = rightCorner.y - topCorner.y;
  const neLen = Math.hypot(neDx, neDy);
  
  // Crosswalk parameters
  const crosswalkPos = 0.85; // Position along road (toward intersection)
  const stripeLen = roadW * 0.22; // Short stripes parallel to traffic
  const numStripes = 10;
  const stripeSpacing = roadW * 0.30;
  
  // Helper to draw crosswalk for a road direction
  const drawCrosswalk = (
    edgeX: number, edgeY: number,
    dirDx: number, dirDy: number,  // Direction toward edge (traffic flow)
    perpDx: number, perpDy: number  // Perpendicular (across road)
  ) => {
    // Center of crosswalk
    const cwX = cx + (edgeX - cx) * crosswalkPos;
    const cwY = cy + (edgeY - cy) * crosswalkPos;
    
    // Draw stripes spaced across the road width
    for (let i = 0; i < numStripes; i++) {
      const offset = (i - (numStripes - 1) / 2) * stripeSpacing;
      const stripeX = cwX + perpDx * offset;
      const stripeY = cwY + perpDy * offset;
      
      // Each stripe runs parallel to traffic direction
      ctx.beginPath();
      ctx.moveTo(stripeX - dirDx * stripeLen, stripeY - dirDy * stripeLen);
      ctx.lineTo(stripeX + dirDx * stripeLen, stripeY + dirDy * stripeLen);
      ctx.stroke();
    }
  };
  
  // North road - traffic flows along north direction, stripes spaced along NW edge
  if (northAdj) {
    drawCrosswalk(northEdgeX, northEdgeY, northDx, northDy, nwDx / nwLen, nwDy / nwLen);
  }
  // East road
  if (eastAdj) {
    drawCrosswalk(eastEdgeX, eastEdgeY, eastDx, eastDy, neDx / neLen, neDy / neLen);
  }
  // South road
  if (southAdj) {
    drawCrosswalk(southEdgeX, southEdgeY, southDx, southDy, nwDx / nwLen, nwDy / nwLen);
  }
  // West road
  if (westAdj) {
    drawCrosswalk(westEdgeX, westEdgeY, westDx, westDy, neDx / neLen, neDy / neLen);
  }
}
