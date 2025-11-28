/**
 * Sophisticated Traffic System
 * Handles road classification, merging, traffic lights, and lane management
 */

import { Tile } from '@/types/game';
import { TILE_WIDTH, TILE_HEIGHT } from './types';

// ============================================================================
// Types
// ============================================================================

/** Road classification based on width/connectivity */
export type RoadType = 'street' | 'avenue' | 'highway';

/** Traffic light states */
export type TrafficLightState = 'green_ns' | 'yellow_ns' | 'red_ns' | 'green_ew' | 'yellow_ew' | 'red_ew';

/** Road segment info with classification */
export interface RoadSegmentInfo {
  x: number;
  y: number;
  type: RoadType;
  laneCount: number;
  hasNorth: boolean;
  hasEast: boolean;
  hasSouth: boolean;
  hasWest: boolean;
  isIntersection: boolean;
  isCurve: boolean;
  isStraightNS: boolean;
  isStraightEW: boolean;
  isDeadEnd: boolean;
  parallelNorth: boolean; // Has parallel road to north-east
  parallelSouth: boolean; // Has parallel road to south-west
  mergedWidth: number; // Width of merged road section (1, 2, or 3+)
  hasTrafficLight: boolean;
  trafficLightPhase: number; // 0-7 for different phases
}

/** Traffic light at an intersection */
export interface TrafficLight {
  x: number;
  y: number;
  state: TrafficLightState;
  timer: number;
  cycleLength: number;
}

// ============================================================================
// Constants
// ============================================================================

// Traffic light timing (in game ticks at speed 1)
export const TRAFFIC_LIGHT_CYCLE_LENGTH = 480; // ~8 seconds at 60fps
export const TRAFFIC_LIGHT_YELLOW_DURATION = 60; // ~1 second

// Road colors
export const ROAD_COLORS = {
  asphalt: '#3a3a3a',
  asphaltLight: '#4a4a4a',
  asphaltDark: '#2a2a2a',
  laneLine: '#ffffff',
  centerLine: '#fbbf24',
  sidewalk: '#9ca3af',
  sidewalkCurb: '#6b7280',
  median: '#4a7c3f',
  medianEdge: '#3d6634',
} as const;

// Traffic light colors
export const LIGHT_COLORS = {
  red: '#ef4444',
  yellow: '#fbbf24',
  green: '#22c55e',
  off: '#1f2937',
  housing: '#374151',
} as const;

// ============================================================================
// Road Analysis
// ============================================================================

/**
 * Check if a tile is a road
 */
export function isRoad(grid: Tile[][], gridSize: number, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) return false;
  return grid[y][x].building.type === 'road';
}

/**
 * Get adjacent road info
 */
export function getAdjacentRoads(grid: Tile[][], gridSize: number, x: number, y: number): {
  north: boolean;
  east: boolean;
  south: boolean;
  west: boolean;
  count: number;
} {
  const north = isRoad(grid, gridSize, x - 1, y);
  const east = isRoad(grid, gridSize, x, y - 1);
  const south = isRoad(grid, gridSize, x + 1, y);
  const west = isRoad(grid, gridSize, x, y + 1);
  
  return {
    north,
    east,
    south,
    west,
    count: (north ? 1 : 0) + (east ? 1 : 0) + (south ? 1 : 0) + (west ? 1 : 0),
  };
}

/**
 * Check for parallel roads (for merging into avenues/highways)
 * Checks if there's a road one tile away in a perpendicular direction
 */
export function getParallelRoads(grid: Tile[][], gridSize: number, x: number, y: number): {
  northEast: boolean; // Road at (x-1, y-1) - diagonal, for wider corridors
  southWest: boolean; // Road at (x+1, y+1)
  northWest: boolean; // Road at (x-1, y+1)
  southEast: boolean; // Road at (x+1, y-1)
} {
  return {
    northEast: isRoad(grid, gridSize, x - 1, y - 1),
    southWest: isRoad(grid, gridSize, x + 1, y + 1),
    northWest: isRoad(grid, gridSize, x - 1, y + 1),
    southEast: isRoad(grid, gridSize, x + 1, y - 1),
  };
}

/**
 * Analyze road width - count how many parallel roads form a wider road
 */
export function analyzeRoadWidth(
  grid: Tile[][],
  gridSize: number,
  x: number,
  y: number,
  adjacent: ReturnType<typeof getAdjacentRoads>
): { width: number; isWideNS: boolean; isWideEW: boolean } {
  let width = 1;
  let isWideNS = false;
  let isWideEW = false;
  
  // For N-S roads, check if there's a parallel road to the east (y-1) or west (y+1)
  if ((adjacent.north || adjacent.south) && !(adjacent.east && adjacent.west)) {
    // This is a N-S oriented road segment
    // Check for parallel roads
    const parallelEast = isRoad(grid, gridSize, x, y - 1) && 
      !isRoad(grid, gridSize, x - 1, y - 1) && !isRoad(grid, gridSize, x + 1, y - 1);
    const parallelWest = isRoad(grid, gridSize, x, y + 1) &&
      !isRoad(grid, gridSize, x - 1, y + 1) && !isRoad(grid, gridSize, x + 1, y + 1);
    
    // If we have adjacent N-S roads that also have N-S orientation, it's a wide road
    if (adjacent.north && adjacent.south) {
      // Check eastern neighbor
      if (isRoad(grid, gridSize, x, y - 1)) {
        const eastAdj = getAdjacentRoads(grid, gridSize, x, y - 1);
        if (eastAdj.north && eastAdj.south && !eastAdj.east) {
          width = 2;
          isWideNS = true;
        }
      }
      // Check western neighbor  
      if (isRoad(grid, gridSize, x, y + 1)) {
        const westAdj = getAdjacentRoads(grid, gridSize, x, y + 1);
        if (westAdj.north && westAdj.south && !westAdj.west) {
          width = Math.max(width, 2);
          isWideNS = true;
        }
      }
    }
  }
  
  // For E-W roads, check for parallel roads to north (x-1) or south (x+1)
  if ((adjacent.east || adjacent.west) && !(adjacent.north && adjacent.south)) {
    if (adjacent.east && adjacent.west) {
      // Check northern neighbor
      if (isRoad(grid, gridSize, x - 1, y)) {
        const northAdj = getAdjacentRoads(grid, gridSize, x - 1, y);
        if (northAdj.east && northAdj.west && !northAdj.north) {
          width = 2;
          isWideEW = true;
        }
      }
      // Check southern neighbor
      if (isRoad(grid, gridSize, x + 1, y)) {
        const southAdj = getAdjacentRoads(grid, gridSize, x + 1, y);
        if (southAdj.east && southAdj.west && !southAdj.south) {
          width = Math.max(width, 2);
          isWideEW = true;
        }
      }
    }
  }
  
  return { width, isWideNS, isWideEW };
}

/**
 * Determine if this road should have a traffic light
 * Traffic lights appear at 3-way and 4-way intersections
 */
export function shouldHaveTrafficLight(adjacent: ReturnType<typeof getAdjacentRoads>): boolean {
  return adjacent.count >= 3;
}

/**
 * Analyze a road tile and return detailed segment information
 */
export function analyzeRoadSegment(
  grid: Tile[][],
  gridSize: number,
  x: number,
  y: number
): RoadSegmentInfo | null {
  if (!isRoad(grid, gridSize, x, y)) return null;
  
  const adjacent = getAdjacentRoads(grid, gridSize, x, y);
  const parallel = getParallelRoads(grid, gridSize, x, y);
  const widthInfo = analyzeRoadWidth(grid, gridSize, x, y, adjacent);
  
  const isIntersection = adjacent.count >= 3;
  const isCurve = adjacent.count === 2 && (
    (adjacent.north && adjacent.east) ||
    (adjacent.east && adjacent.south) ||
    (adjacent.south && adjacent.west) ||
    (adjacent.west && adjacent.north)
  );
  const isStraightNS = adjacent.north && adjacent.south && !adjacent.east && !adjacent.west;
  const isStraightEW = adjacent.east && adjacent.west && !adjacent.north && !adjacent.south;
  const isDeadEnd = adjacent.count <= 1;
  
  // Determine road type based on width and traffic
  let roadType: RoadType = 'street';
  if (widthInfo.width >= 3) {
    roadType = 'highway';
  } else if (widthInfo.width >= 2 || isIntersection) {
    roadType = 'avenue';
  }
  
  return {
    x,
    y,
    type: roadType,
    laneCount: Math.max(1, widthInfo.width),
    hasNorth: adjacent.north,
    hasEast: adjacent.east,
    hasSouth: adjacent.south,
    hasWest: adjacent.west,
    isIntersection,
    isCurve,
    isStraightNS,
    isStraightEW,
    isDeadEnd,
    parallelNorth: parallel.northEast || parallel.northWest,
    parallelSouth: parallel.southEast || parallel.southWest,
    mergedWidth: widthInfo.width,
    hasTrafficLight: shouldHaveTrafficLight(adjacent),
    trafficLightPhase: 0,
  };
}

// ============================================================================
// Traffic Light Management
// ============================================================================

/** Global traffic light state - synced across all lights */
let globalTrafficTimer = 0;
let globalLightState: TrafficLightState = 'green_ns';

/**
 * Update the global traffic light timer
 * Called once per frame
 */
export function updateTrafficLights(deltaTime: number): void {
  globalTrafficTimer += deltaTime;
  
  // Full cycle: green_ns (3s) -> yellow_ns (1s) -> green_ew (3s) -> yellow_ew (1s)
  const cycleTime = 8000; // 8 seconds total cycle
  const phase = globalTrafficTimer % cycleTime;
  
  if (phase < 3000) {
    globalLightState = 'green_ns';
  } else if (phase < 4000) {
    globalLightState = 'yellow_ns';
  } else if (phase < 7000) {
    globalLightState = 'green_ew';
  } else {
    globalLightState = 'yellow_ew';
  }
}

/**
 * Get the current global traffic light state
 */
export function getTrafficLightState(): TrafficLightState {
  return globalLightState;
}

/**
 * Get colors for traffic lights based on current state
 */
export function getTrafficLightColors(state: TrafficLightState): {
  ns: { red: string; yellow: string; green: string };
  ew: { red: string; yellow: string; green: string };
} {
  const offColor = LIGHT_COLORS.off;
  
  switch (state) {
    case 'green_ns':
      return {
        ns: { red: offColor, yellow: offColor, green: LIGHT_COLORS.green },
        ew: { red: LIGHT_COLORS.red, yellow: offColor, green: offColor },
      };
    case 'yellow_ns':
      return {
        ns: { red: offColor, yellow: LIGHT_COLORS.yellow, green: offColor },
        ew: { red: LIGHT_COLORS.red, yellow: offColor, green: offColor },
      };
    case 'green_ew':
      return {
        ns: { red: LIGHT_COLORS.red, yellow: offColor, green: offColor },
        ew: { red: offColor, yellow: offColor, green: LIGHT_COLORS.green },
      };
    case 'yellow_ew':
      return {
        ns: { red: LIGHT_COLORS.red, yellow: offColor, green: offColor },
        ew: { red: offColor, yellow: LIGHT_COLORS.yellow, green: offColor },
      };
    default:
      return {
        ns: { red: LIGHT_COLORS.red, yellow: offColor, green: offColor },
        ew: { red: LIGHT_COLORS.red, yellow: offColor, green: offColor },
      };
  }
}

// ============================================================================
// Road Drawing Helpers
// ============================================================================

/**
 * Draw a traffic light pole and signals
 * Very simple design: small post with 3 colored circles
 */
export function drawTrafficLight(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  direction: 'ns' | 'ew',
  colors: { red: string; yellow: string; green: string },
  scale: number = 1
): void {
  const lightSize = 2.5 * scale;
  const spacing = 3 * scale;
  const poleWidth = 2 * scale;
  const poleHeight = 12 * scale;
  const housingWidth = 6 * scale;
  const housingHeight = 14 * scale;
  
  ctx.save();
  
  // Draw pole
  ctx.fillStyle = '#374151';
  ctx.fillRect(x - poleWidth / 2, y, poleWidth, poleHeight);
  
  // Draw housing (dark box behind lights)
  const housingX = x - housingWidth / 2;
  const housingY = y - housingHeight - 2 * scale;
  ctx.fillStyle = LIGHT_COLORS.housing;
  ctx.fillRect(housingX, housingY, housingWidth, housingHeight);
  
  // Draw border
  ctx.strokeStyle = '#1f2937';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(housingX, housingY, housingWidth, housingHeight);
  
  // Draw lights (red on top, yellow middle, green bottom)
  const lightX = x;
  const redY = housingY + spacing;
  const yellowY = housingY + spacing * 2 + lightSize;
  const greenY = housingY + spacing * 3 + lightSize * 2;
  
  // Red light
  ctx.beginPath();
  ctx.arc(lightX, redY, lightSize, 0, Math.PI * 2);
  ctx.fillStyle = colors.red;
  ctx.fill();
  
  // Yellow light
  ctx.beginPath();
  ctx.arc(lightX, yellowY, lightSize, 0, Math.PI * 2);
  ctx.fillStyle = colors.yellow;
  ctx.fill();
  
  // Green light
  ctx.beginPath();
  ctx.arc(lightX, greenY, lightSize, 0, Math.PI * 2);
  ctx.fillStyle = colors.green;
  ctx.fill();
  
  ctx.restore();
}

/**
 * Draw lane direction arrows
 */
export function drawLaneArrow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  direction: 'north' | 'east' | 'south' | 'west',
  scale: number = 1
): void {
  const arrowLength = 6 * scale;
  const arrowWidth = 3 * scale;
  
  ctx.save();
  ctx.translate(x, y);
  
  // Rotate based on direction
  switch (direction) {
    case 'north': ctx.rotate(-Math.PI * 0.75); break; // NW in isometric
    case 'east': ctx.rotate(-Math.PI * 0.25); break;  // NE in isometric
    case 'south': ctx.rotate(Math.PI * 0.25); break;  // SE in isometric
    case 'west': ctx.rotate(Math.PI * 0.75); break;   // SW in isometric
  }
  
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.beginPath();
  ctx.moveTo(0, -arrowLength);
  ctx.lineTo(arrowWidth, 0);
  ctx.lineTo(arrowWidth * 0.3, 0);
  ctx.lineTo(arrowWidth * 0.3, arrowLength * 0.5);
  ctx.lineTo(-arrowWidth * 0.3, arrowLength * 0.5);
  ctx.lineTo(-arrowWidth * 0.3, 0);
  ctx.lineTo(-arrowWidth, 0);
  ctx.closePath();
  ctx.fill();
  
  ctx.restore();
}

/**
 * Draw a central median/divider for avenues
 */
export function drawMedian(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  width: number
): void {
  // Calculate perpendicular direction
  const dx = endX - startX;
  const dy = endY - startY;
  const len = Math.hypot(dx, dy);
  if (len < 1) return;
  
  const perpX = -dy / len * width / 2;
  const perpY = dx / len * width / 2;
  
  // Draw median base (darker green)
  ctx.fillStyle = ROAD_COLORS.medianEdge;
  ctx.beginPath();
  ctx.moveTo(startX + perpX, startY + perpY);
  ctx.lineTo(endX + perpX, endY + perpY);
  ctx.lineTo(endX - perpX, endY - perpY);
  ctx.lineTo(startX - perpX, startY - perpY);
  ctx.closePath();
  ctx.fill();
  
  // Draw median surface (lighter green)
  const inset = width * 0.15;
  const insetPerpX = perpX * (1 - inset * 2 / width);
  const insetPerpY = perpY * (1 - inset * 2 / width);
  
  ctx.fillStyle = ROAD_COLORS.median;
  ctx.beginPath();
  ctx.moveTo(startX + insetPerpX, startY + insetPerpY);
  ctx.lineTo(endX + insetPerpX, endY + insetPerpY);
  ctx.lineTo(endX - insetPerpX, endY - insetPerpY);
  ctx.lineTo(startX - insetPerpX, startY - insetPerpY);
  ctx.closePath();
  ctx.fill();
  
  // Add some simple plant dots
  const plantCount = Math.floor(len / 8);
  if (plantCount > 0) {
    ctx.fillStyle = '#22c55e';
    for (let i = 0; i < plantCount; i++) {
      const t = (i + 0.5) / plantCount;
      const px = startX + dx * t + (Math.random() - 0.5) * width * 0.3;
      const py = startY + dy * t + (Math.random() - 0.5) * width * 0.3;
      ctx.beginPath();
      ctx.arc(px, py, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/**
 * Draw turn lane arrows at intersections
 */
export function drawTurnArrows(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  segment: RoadSegmentInfo,
  scale: number = 1
): void {
  if (!segment.isIntersection) return;
  
  const offset = 12 * scale;
  
  // Draw arrows for each incoming direction
  if (segment.hasNorth) {
    // Arrow showing traffic coming from north continues south
    drawLaneArrow(ctx, cx - offset * 0.7, cy - offset * 0.3, 'south', scale * 0.8);
  }
  if (segment.hasEast) {
    // Arrow showing traffic coming from east continues west
    drawLaneArrow(ctx, cx + offset * 0.3, cy - offset * 0.7, 'west', scale * 0.8);
  }
  if (segment.hasSouth) {
    // Arrow showing traffic coming from south continues north
    drawLaneArrow(ctx, cx + offset * 0.7, cy + offset * 0.3, 'north', scale * 0.8);
  }
  if (segment.hasWest) {
    // Arrow showing traffic coming from west continues east  
    drawLaneArrow(ctx, cx - offset * 0.3, cy + offset * 0.7, 'east', scale * 0.8);
  }
}

// ============================================================================
// Avenue/Highway Detection for Merged Roads
// ============================================================================

/**
 * Check if two adjacent road tiles form part of a merged avenue
 * Returns the direction of the avenue if they do
 */
export function checkMergedAvenue(
  grid: Tile[][],
  gridSize: number,
  x: number,
  y: number
): { isMerged: boolean; direction: 'ns' | 'ew' | null; isLeftLane: boolean; isRightLane: boolean } {
  if (!isRoad(grid, gridSize, x, y)) {
    return { isMerged: false, direction: null, isLeftLane: false, isRightLane: false };
  }
  
  const adj = getAdjacentRoads(grid, gridSize, x, y);
  
  // Check for N-S avenue (parallel roads running north-south)
  if (adj.north || adj.south) {
    // Check if there's a parallel road to east that also runs N-S
    if (isRoad(grid, gridSize, x, y - 1)) {
      const eastAdj = getAdjacentRoads(grid, gridSize, x, y - 1);
      if ((eastAdj.north || eastAdj.south) && 
          ((adj.north && eastAdj.north) || (adj.south && eastAdj.south))) {
        // This is the western lane of a N-S avenue
        return { isMerged: true, direction: 'ns', isLeftLane: true, isRightLane: false };
      }
    }
    // Check if there's a parallel road to west that also runs N-S
    if (isRoad(grid, gridSize, x, y + 1)) {
      const westAdj = getAdjacentRoads(grid, gridSize, x, y + 1);
      if ((westAdj.north || westAdj.south) &&
          ((adj.north && westAdj.north) || (adj.south && westAdj.south))) {
        // This is the eastern lane of a N-S avenue
        return { isMerged: true, direction: 'ns', isLeftLane: false, isRightLane: true };
      }
    }
  }
  
  // Check for E-W avenue (parallel roads running east-west)
  if (adj.east || adj.west) {
    // Check if there's a parallel road to north that also runs E-W
    if (isRoad(grid, gridSize, x - 1, y)) {
      const northAdj = getAdjacentRoads(grid, gridSize, x - 1, y);
      if ((northAdj.east || northAdj.west) &&
          ((adj.east && northAdj.east) || (adj.west && northAdj.west))) {
        // This is the southern lane of an E-W avenue
        return { isMerged: true, direction: 'ew', isLeftLane: false, isRightLane: true };
      }
    }
    // Check if there's a parallel road to south that also runs E-W
    if (isRoad(grid, gridSize, x + 1, y)) {
      const southAdj = getAdjacentRoads(grid, gridSize, x + 1, y);
      if ((southAdj.east || southAdj.west) &&
          ((adj.east && southAdj.east) || (adj.west && southAdj.west))) {
        // This is the northern lane of an E-W avenue
        return { isMerged: true, direction: 'ew', isLeftLane: true, isRightLane: false };
      }
    }
  }
  
  return { isMerged: false, direction: null, isLeftLane: false, isRightLane: false };
}

/**
 * Analyze a road for drawing - returns comprehensive info for rendering
 */
export interface RoadDrawInfo {
  segment: RoadSegmentInfo;
  mergeInfo: ReturnType<typeof checkMergedAvenue>;
  trafficLightState: TrafficLightState;
  shouldDrawMedian: boolean;
  shouldDrawTrafficLight: boolean;
  laneDirections: {
    northbound: boolean;
    eastbound: boolean;
    southbound: boolean;
    westbound: boolean;
  };
}

export function getRoadDrawInfo(
  grid: Tile[][],
  gridSize: number,
  x: number,
  y: number
): RoadDrawInfo | null {
  const segment = analyzeRoadSegment(grid, gridSize, x, y);
  if (!segment) return null;
  
  const mergeInfo = checkMergedAvenue(grid, gridSize, x, y);
  const trafficLightState = getTrafficLightState();
  
  // Determine lane flow directions based on merge info
  // In merged avenues, each lane has a specific direction
  let laneDirections = {
    northbound: segment.hasNorth || segment.hasSouth,
    eastbound: segment.hasEast || segment.hasWest,
    southbound: segment.hasNorth || segment.hasSouth,
    westbound: segment.hasEast || segment.hasWest,
  };
  
  if (mergeInfo.isMerged) {
    if (mergeInfo.direction === 'ns') {
      // N-S avenue: left lane goes north, right lane goes south
      laneDirections = {
        northbound: mergeInfo.isLeftLane,
        eastbound: false,
        southbound: mergeInfo.isRightLane,
        westbound: false,
      };
    } else if (mergeInfo.direction === 'ew') {
      // E-W avenue: left lane goes east, right lane goes west
      laneDirections = {
        northbound: false,
        eastbound: mergeInfo.isLeftLane,
        southbound: false,
        westbound: mergeInfo.isRightLane,
      };
    }
  }
  
  return {
    segment,
    mergeInfo,
    trafficLightState,
    shouldDrawMedian: mergeInfo.isMerged && (mergeInfo.isLeftLane || mergeInfo.isRightLane),
    shouldDrawTrafficLight: segment.hasTrafficLight,
    laneDirections,
  };
}
