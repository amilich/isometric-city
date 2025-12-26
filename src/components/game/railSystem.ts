/**
 * Rail System - Railway track rendering and train management
 * Handles track connections, curves, spurs, and multi-carriage trains
 */

import { Tile } from '@/types/game';
import { TILE_WIDTH, TILE_HEIGHT, CarDirection } from './types';

// ============================================================================
// Types
// ============================================================================

/** Rail track connection pattern */
export type RailConnection = {
  north: boolean;
  east: boolean;
  south: boolean;
  west: boolean;
};

/** Track segment type based on connections */
export type TrackType = 
  | 'straight_ns'     // North-South straight
  | 'straight_ew'     // East-West straight
  | 'curve_ne'        // Curves connecting N-E
  | 'curve_nw'        // Curves connecting N-W
  | 'curve_se'        // Curves connecting S-E
  | 'curve_sw'        // Curves connecting S-W
  | 'junction_t_n'    // T-junction, no north
  | 'junction_t_e'    // T-junction, no east
  | 'junction_t_s'    // T-junction, no south
  | 'junction_t_w'    // T-junction, no west
  | 'junction_cross'  // 4-way crossing
  | 'terminus_n'      // Dead-end facing north
  | 'terminus_e'      // Dead-end facing east
  | 'terminus_s'      // Dead-end facing south
  | 'terminus_w'      // Dead-end facing west
  | 'single';         // Isolated single track

/** Train carriage type */
export type CarriageType = 'locomotive' | 'passenger' | 'freight_box' | 'freight_tank' | 'freight_flat' | 'caboose';

/** Train type */
export type TrainType = 'passenger' | 'freight';

/** Individual train carriage */
export interface TrainCarriage {
  type: CarriageType;
  color: string;
  // Position along the train's path (0-1 within current tile segment)
  progress: number;
  // Current tile position
  tileX: number;
  tileY: number;
  // Direction of travel
  direction: CarDirection;
}

/** Complete train with multiple carriages */
export interface Train {
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
}

// ============================================================================
// Constants
// ============================================================================

/** Rail track colors */
export const RAIL_COLORS = {
  BALLAST: '#9B8365',           // Track bed (gravel/ballast) - lighter for contrast
  BALLAST_DARK: '#7B6354',      // Darker ballast edges
  TIE: '#5c422e',               // Wooden rail ties (sleepers)
  TIE_HIGHLIGHT: '#7a5d48',     // Lighter tie surface
  RAIL: '#6a6a6a',              // Steel rail - silvery
  RAIL_HIGHLIGHT: '#8a8a8a',    // Rail highlight
  RAIL_SHADOW: '#404040',       // Rail shadow
  // Bridge-specific colors (metallic steel look)
  BRIDGE_DECK: '#7a8088',       // Steel bridge deck - bluish gray metal
  BRIDGE_TIE: '#4a4a4a',        // Metal/treated wood ties on bridge
};

/** Locomotive colors (various liveries) */
export const LOCOMOTIVE_COLORS = [
  '#1e40af', // Blue
  '#dc2626', // Red
  '#059669', // Green
  '#7c3aed', // Purple
  '#ea580c', // Orange
  '#0891b2', // Cyan
];

/** Freight car colors */
export const FREIGHT_COLORS = [
  '#8B4513', // Brown
  '#696969', // Gray
  '#2F4F4F', // Dark slate
  '#8B0000', // Dark red
  '#006400', // Dark green
  '#4682B4', // Steel blue
];

/** Passenger car colors */
export const PASSENGER_COLORS = [
  '#C0C0C0', // Silver
  '#1e40af', // Blue
  '#059669', // Green
  '#7c3aed', // Purple
];

/** Track gauge (width between rails) as ratio of tile width - smaller for double track */
export const TRACK_GAUGE_RATIO = 0.06;

/** Ballast width as ratio of tile width - wider for visibility */
export const BALLAST_WIDTH_RATIO = 0.18;

/** Number of ties per tile */
export const TIES_PER_TILE = 7;

/** Separation between the two parallel tracks as ratio of tile width */
export const TRACK_SEPARATION_RATIO = 0.22;

/** Train car dimensions - sized for visibility on double track */
export const TRAIN_CAR = {
  LOCOMOTIVE_LENGTH: 25,      // Longer locomotive
  CAR_LENGTH: 16,             // Passenger car length
  FREIGHT_CAR_LENGTH: 28,     // Freight cars are ~1.75x longer
  CAR_WIDTH: 4.3,             // Thinner cars
  CAR_SPACING: 3,             // Gap between cars
};

/** Which track a train uses based on direction (0 = left/inner, 1 = right/outer) */
export type TrackSide = 0 | 1;

/** Get which track side a train should use based on its direction */
export function getTrackSide(direction: CarDirection): TrackSide {
  // Convention: north/east bound trains use track 0, south/west bound use track 1
  // This creates right-hand traffic (like most railways)
  return (direction === 'north' || direction === 'east') ? 0 : 1;
}

// ============================================================================
// Rail Analysis Functions
// ============================================================================

/**
 * Check if a tile is a rail track (pure rail tile, road with rail overlay, OR rail bridge)
 */
export function isRailTile(grid: Tile[][], gridSize: number, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) return false;
  const tile = grid[y][x];
  // Rail tile, road with rail overlay, or rail bridge
  return tile.building.type === 'rail' || 
         (tile.building.type === 'road' && tile.hasRailOverlay === true) ||
         (tile.building.type === 'bridge' && tile.building.bridgeTrackType === 'rail');
}

/**
 * Check if a tile is a rail station (including all tiles of a 2x2 station)
 */
export function isRailStationTile(grid: Tile[][], gridSize: number, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) return false;
  const tile = grid[y][x];
  
  // Direct rail_station tile (origin)
  if (tile.building.type === 'rail_station') return true;
  
  // Check if this 'empty' tile is part of a 2x2 rail_station
  if (tile.building.type === 'empty') {
    // Check tile to the west (this could be origin if we're in east column)
    if (x > 0 && grid[y][x - 1]?.building.type === 'rail_station') return true;
    // Check tile to the north (this could be origin if we're in south row)
    if (y > 0 && grid[y - 1][x]?.building.type === 'rail_station') return true;
    // Check tile to the northwest (this could be origin if we're in southeast corner)
    if (x > 0 && y > 0 && grid[y - 1][x - 1]?.building.type === 'rail_station') return true;
  }
  
  return false;
}

/**
 * Check if a tile has rail (either pure rail tile, road with rail overlay, rail bridge, OR part of rail station)
 */
function hasRailAtPosition(grid: Tile[][], gridSize: number, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) return false;
  const tile = grid[y][x];
  return tile.building.type === 'rail' || 
         isRailStationTile(grid, gridSize, x, y) || 
         (tile.building.type === 'road' && tile.hasRailOverlay === true) ||
         (tile.building.type === 'bridge' && tile.building.bridgeTrackType === 'rail');
}

/**
 * Get adjacent rail connections for a tile
 * Recognizes both pure rail tiles AND road tiles with rail overlay
 */
export function getAdjacentRail(
  grid: Tile[][],
  gridSize: number,
  x: number,
  y: number
): RailConnection {
  return {
    north: hasRailAtPosition(grid, gridSize, x - 1, y),
    east: hasRailAtPosition(grid, gridSize, x, y - 1),
    south: hasRailAtPosition(grid, gridSize, x + 1, y),
    west: hasRailAtPosition(grid, gridSize, x, y + 1),
  };
}

/**
 * Determine track type based on connections
 */
export function getTrackType(connections: RailConnection): TrackType {
  const { north, east, south, west } = connections;
  const count = [north, east, south, west].filter(Boolean).length;

  // 4-way crossing
  if (count === 4) return 'junction_cross';

  // T-junctions (3 connections)
  if (count === 3) {
    if (!north) return 'junction_t_n';
    if (!east) return 'junction_t_e';
    if (!south) return 'junction_t_s';
    if (!west) return 'junction_t_w';
  }

  // Straight tracks (2 opposite connections)
  if (north && south && !east && !west) return 'straight_ns';
  if (east && west && !north && !south) return 'straight_ew';

  // Curves (2 adjacent connections)
  if (north && east && !south && !west) return 'curve_ne';
  if (north && west && !south && !east) return 'curve_nw';
  if (south && east && !north && !west) return 'curve_se';
  if (south && west && !north && !east) return 'curve_sw';

  // Dead ends (1 connection)
  if (count === 1) {
    if (north) return 'terminus_s';  // Track faces south (connects to north)
    if (east) return 'terminus_w';   // Track faces west (connects to east)
    if (south) return 'terminus_n';  // Track faces north (connects to south)
    if (west) return 'terminus_e';   // Track faces east (connects to west)
  }

  // Isolated or unconnected
  return 'single';
}

// ============================================================================
// Track Drawing Functions - Double Track System
// ============================================================================

// Isometric axis directions (normalized) - these align with the grid
// N-S axis: from northEdge to southEdge (top-left to bottom-right on screen)
const ISO_NS = { x: 0.894427, y: 0.447214 };
// E-W axis: from eastEdge to westEdge (top-right to bottom-left on screen)  
const ISO_EW = { x: -0.894427, y: 0.447214 };
const NEG_ISO_EW = { x: -ISO_EW.x, y: -ISO_EW.y };
const NEG_ISO_NS = { x: -ISO_NS.x, y: -ISO_NS.y };

/** Offset a point along a perpendicular direction */
function offsetPoint(
  pt: { x: number; y: number },
  perp: { x: number; y: number },
  amount: number
): { x: number; y: number } {
  return { x: pt.x + perp.x * amount, y: pt.y + perp.y * amount };
}

/**
 * Draw the ballast (gravel bed) foundation for DOUBLE tracks
 */
function drawBallast(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  trackType: TrackType,
  _zoom: number
): void {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const ballastW = w * BALLAST_WIDTH_RATIO;
  const halfW = ballastW / 2;
  const trackSep = w * TRACK_SEPARATION_RATIO;
  const halfSep = trackSep / 2;

  // Calculate edge midpoints (where tracks meet tile edges)
  const northEdge = { x: x + w * 0.25, y: y + h * 0.25 };
  const eastEdge = { x: x + w * 0.75, y: y + h * 0.25 };
  const southEdge = { x: x + w * 0.75, y: y + h * 0.75 };
  const westEdge = { x: x + w * 0.25, y: y + h * 0.75 };
  const center = { x: cx, y: cy };

  ctx.fillStyle = RAIL_COLORS.BALLAST;

  // Draw a straight ballast segment for a single track
  const drawSingleStraightBallast = (
    from: { x: number; y: number },
    to: { x: number; y: number },
    perp: { x: number; y: number }
  ) => {
    ctx.beginPath();
    ctx.moveTo(from.x + perp.x * halfW, from.y + perp.y * halfW);
    ctx.lineTo(to.x + perp.x * halfW, to.y + perp.y * halfW);
    ctx.lineTo(to.x - perp.x * halfW, to.y - perp.y * halfW);
    ctx.lineTo(from.x - perp.x * halfW, from.y - perp.y * halfW);
    ctx.closePath();
    ctx.fill();
  };

  // Draw double straight ballast (two parallel tracks)
  const drawDoubleStraightBallast = (
    from: { x: number; y: number },
    to: { x: number; y: number },
    perp: { x: number; y: number }
  ) => {
    // Track 0 (offset in +perp direction)
    const from0 = offsetPoint(from, perp, halfSep);
    const to0 = offsetPoint(to, perp, halfSep);
    drawSingleStraightBallast(from0, to0, perp);
    
    // Track 1 (offset in -perp direction)
    const from1 = offsetPoint(from, perp, -halfSep);
    const to1 = offsetPoint(to, perp, -halfSep);
    drawSingleStraightBallast(from1, to1, perp);
  };

  // Draw curved ballast for a single track
  const drawSingleCurvedBallast = (
    from: { x: number; y: number },
    to: { x: number; y: number },
    control: { x: number; y: number },
    fromPerp: { x: number; y: number },
    toPerp: { x: number; y: number }
  ) => {
    const midPerp = {
      x: (fromPerp.x + toPerp.x) / 2,
      y: (fromPerp.y + toPerp.y) / 2
    };
    const midLen = Math.hypot(midPerp.x, midPerp.y);
    const normMidPerp = { x: midPerp.x / midLen, y: midPerp.y / midLen };

    ctx.beginPath();
    ctx.moveTo(from.x + fromPerp.x * halfW, from.y + fromPerp.y * halfW);
    ctx.quadraticCurveTo(
      control.x + normMidPerp.x * halfW, control.y + normMidPerp.y * halfW,
      to.x + toPerp.x * halfW, to.y + toPerp.y * halfW
    );
    ctx.lineTo(to.x - toPerp.x * halfW, to.y - toPerp.y * halfW);
    ctx.quadraticCurveTo(
      control.x - normMidPerp.x * halfW, control.y - normMidPerp.y * halfW,
      from.x - fromPerp.x * halfW, from.y - fromPerp.y * halfW
    );
    ctx.closePath();
    ctx.fill();
  };

  // Draw double curved ballast (two parallel curved tracks)
  const drawDoubleCurvedBallast = (
    from: { x: number; y: number },
    to: { x: number; y: number },
    control: { x: number; y: number },
    fromPerp: { x: number; y: number },
    toPerp: { x: number; y: number },
    curvePerp: { x: number; y: number } // Direction to offset for parallel curves
  ) => {
    // Track 0 (outer curve)
    const from0 = offsetPoint(from, fromPerp, halfSep);
    const to0 = offsetPoint(to, toPerp, halfSep);
    const ctrl0 = offsetPoint(control, curvePerp, halfSep);
    drawSingleCurvedBallast(from0, to0, ctrl0, fromPerp, toPerp);
    
    // Track 1 (inner curve)
    const from1 = offsetPoint(from, fromPerp, -halfSep);
    const to1 = offsetPoint(to, toPerp, -halfSep);
    const ctrl1 = offsetPoint(control, curvePerp, -halfSep);
    drawSingleCurvedBallast(from1, to1, ctrl1, fromPerp, toPerp);
  };

  // Draw center area for junctions (covers both tracks)
  // Uses proper isometric diamond aligned with tile grid
  const drawCenterBallast = () => {
    const size = (ballastW + trackSep) * 0.8;
    // Use exact TILE_HEIGHT/TILE_WIDTH ratio (0.5) for proper isometric alignment
    const isoRatio = h / w; // Should be 0.5 for 2:1 isometric
    ctx.beginPath();
    ctx.moveTo(cx, cy - size * isoRatio);  // top
    ctx.lineTo(cx + size, cy);              // right
    ctx.lineTo(cx, cy + size * isoRatio);  // bottom
    ctx.lineTo(cx - size, cy);              // left
    ctx.closePath();
    ctx.fill();
  };

  // Draw based on track type
  switch (trackType) {
    case 'straight_ns':
      drawDoubleStraightBallast(northEdge, southEdge, ISO_EW);
      break;
    case 'straight_ew':
      drawDoubleStraightBallast(eastEdge, westEdge, ISO_NS);
      break;
    case 'curve_ne':
      drawDoubleCurvedBallast(northEdge, eastEdge, center, ISO_EW, ISO_NS, { x: 0, y: 1 });
      break;
    case 'curve_nw':
      // Both perps have +x, so curvePerp should point right (+x)
      drawDoubleCurvedBallast(northEdge, westEdge, center, NEG_ISO_EW, ISO_NS, { x: 1, y: 0 });
      break;
    case 'curve_se':
      // Both perps have -x, so curvePerp should point left (-x)
      drawDoubleCurvedBallast(southEdge, eastEdge, center, ISO_EW, NEG_ISO_NS, { x: -1, y: 0 });
      break;
    case 'curve_sw':
      drawDoubleCurvedBallast(southEdge, westEdge, center, NEG_ISO_EW, NEG_ISO_NS, { x: 0, y: -1 });
      break;
    case 'junction_t_n':
      // Horizontal tracks (east-west)
      drawDoubleStraightBallast(eastEdge, westEdge, ISO_NS);
      // Curved connections from south to east and west (no straight branch - curves provide the connection)
      drawDoubleCurvedBallast(southEdge, eastEdge, center, ISO_EW, NEG_ISO_NS, { x: -1, y: 0 });
      drawDoubleCurvedBallast(southEdge, westEdge, center, NEG_ISO_EW, NEG_ISO_NS, { x: 0, y: -1 });
      drawCenterBallast();
      break;
    case 'junction_t_e':
      // Vertical tracks (north-south)
      drawDoubleStraightBallast(northEdge, southEdge, ISO_EW);
      // Curved connections from west to north and south (no straight branch - curves provide the connection)
      // west-to-north is reversed curve_nw: use ISO_NS, NEG_ISO_EW, { x: 1, y: 0 }
      drawDoubleCurvedBallast(westEdge, northEdge, center, ISO_NS, NEG_ISO_EW, { x: 1, y: 0 });
      drawDoubleCurvedBallast(westEdge, southEdge, center, NEG_ISO_NS, NEG_ISO_EW, { x: 0, y: -1 });
      drawCenterBallast();
      break;
    case 'junction_t_s':
      // Horizontal tracks (east-west)
      drawDoubleStraightBallast(eastEdge, westEdge, ISO_NS);
      // Curved connections from north to east and west (no straight branch - curves provide the connection)
      drawDoubleCurvedBallast(northEdge, eastEdge, center, ISO_EW, ISO_NS, { x: 0, y: 1 });
      drawDoubleCurvedBallast(northEdge, westEdge, center, NEG_ISO_EW, ISO_NS, { x: 1, y: 0 });
      drawCenterBallast();
      break;
    case 'junction_t_w':
      // Vertical tracks (north-south)
      drawDoubleStraightBallast(northEdge, southEdge, ISO_EW);
      // Curved connections from east to north and south (no straight branch - curves provide the connection)
      drawDoubleCurvedBallast(eastEdge, northEdge, center, ISO_NS, ISO_EW, { x: 0, y: 1 });
      drawDoubleCurvedBallast(eastEdge, southEdge, center, ISO_NS, NEG_ISO_EW, { x: 0, y: -1 });
      drawCenterBallast();
      break;
    case 'junction_cross':
      drawDoubleStraightBallast(northEdge, southEdge, ISO_EW);
      drawDoubleStraightBallast(eastEdge, westEdge, ISO_NS);
      drawCenterBallast();
      break;
    case 'terminus_n':
      drawDoubleStraightBallast(center, southEdge, ISO_EW);
      drawCenterBallast();
      break;
    case 'terminus_e':
      drawDoubleStraightBallast(center, westEdge, ISO_NS);
      drawCenterBallast();
      break;
    case 'terminus_s':
      drawDoubleStraightBallast(center, northEdge, ISO_EW);
      drawCenterBallast();
      break;
    case 'terminus_w':
      drawDoubleStraightBallast(center, eastEdge, ISO_NS);
      drawCenterBallast();
      break;
    case 'single': {
      // Draw a short straight ballast segment aligned with actual N-S tile axis
      // Compute directions from tile geometry (not hardcoded ISO vectors which assume 2:1 ratio)
      const nsDirX = southEdge.x - northEdge.x;
      const nsDirY = southEdge.y - northEdge.y;
      const nsLen = Math.hypot(nsDirX, nsDirY);
      const nsDir = { x: nsDirX / nsLen, y: nsDirY / nsLen };
      
      // E-W perpendicular direction (from eastEdge to westEdge)
      const ewDirX = westEdge.x - eastEdge.x;
      const ewDirY = westEdge.y - eastEdge.y;
      const ewLen = Math.hypot(ewDirX, ewDirY);
      const ewDir = { x: ewDirX / ewLen, y: ewDirY / ewLen };
      
      const singleStubLen = nsLen * 0.35; // 35% of half-tile diagonal
      const singleFrom = { x: cx - nsDir.x * singleStubLen, y: cy - nsDir.y * singleStubLen };
      const singleTo = { x: cx + nsDir.x * singleStubLen, y: cy + nsDir.y * singleStubLen };
      drawDoubleStraightBallast(singleFrom, singleTo, ewDir);
      break;
    }
  }
}

/**
 * Draw rail ties (sleepers) for DOUBLE tracks
 */
function drawTies(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  trackType: TrackType,
  zoom: number
): void {
  if (zoom < 0.5) return;

  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const tieWidth = w * 0.018;
  const tieLength = w * BALLAST_WIDTH_RATIO * 0.765;
  const trackSep = w * TRACK_SEPARATION_RATIO;
  const halfSep = trackSep / 2;

  const northEdge = { x: x + w * 0.25, y: y + h * 0.25 };
  const eastEdge = { x: x + w * 0.75, y: y + h * 0.25 };
  const southEdge = { x: x + w * 0.75, y: y + h * 0.75 };
  const westEdge = { x: x + w * 0.25, y: y + h * 0.75 };
  const center = { x: cx, y: cy };

  ctx.fillStyle = RAIL_COLORS.TIE;

  // Draw a single tie using isometric-aligned directions
  // tieDir: direction the tie extends (across the track)
  // tiePerpDir: direction along the track (for tie thickness)
  const drawTie = (
    tieX: number,
    tieY: number,
    tieDir: { x: number; y: number },
    tiePerpDir: { x: number; y: number }
  ) => {
    const halfLen = tieLength / 2;
    const halfWidth = tieWidth / 2;
    
    ctx.beginPath();
    ctx.moveTo(tieX + tieDir.x * halfLen + tiePerpDir.x * halfWidth, tieY + tieDir.y * halfLen + tiePerpDir.y * halfWidth);
    ctx.lineTo(tieX + tieDir.x * halfLen - tiePerpDir.x * halfWidth, tieY + tieDir.y * halfLen - tiePerpDir.y * halfWidth);
    ctx.lineTo(tieX - tieDir.x * halfLen - tiePerpDir.x * halfWidth, tieY - tieDir.y * halfLen - tiePerpDir.y * halfWidth);
    ctx.lineTo(tieX - tieDir.x * halfLen + tiePerpDir.x * halfWidth, tieY - tieDir.y * halfLen + tiePerpDir.y * halfWidth);
    ctx.closePath();
    ctx.fill();
  };

  // Draw ties for a single track along a straight segment
  // tieDir: direction ties extend (perpendicular to track in isometric space)
  // tiePerpDir: direction along the track (for tie thickness)
  const drawSingleTrackTies = (
    from: { x: number; y: number },
    to: { x: number; y: number },
    tieDir: { x: number; y: number },
    tiePerpDir: { x: number; y: number },
    numTies: number
  ) => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    for (let i = 0; i < numTies; i++) {
      const t = (i + 0.5) / numTies;
      drawTie(from.x + dx * t, from.y + dy * t, tieDir, tiePerpDir);
    }
  };

  // Draw ties for double track along a straight segment
  // tieDir: direction ties extend (perpendicular to track)
  // tiePerpDir: direction along the track (for tie thickness)
  // perp: direction to offset the two tracks
  const drawDoubleTies = (
    from: { x: number; y: number },
    to: { x: number; y: number },
    tieDir: { x: number; y: number },
    tiePerpDir: { x: number; y: number },
    perp: { x: number; y: number },
    numTies: number
  ) => {
    // Track 0
    const from0 = offsetPoint(from, perp, halfSep);
    const to0 = offsetPoint(to, perp, halfSep);
    drawSingleTrackTies(from0, to0, tieDir, tiePerpDir, numTies);
    // Track 1
    const from1 = offsetPoint(from, perp, -halfSep);
    const to1 = offsetPoint(to, perp, -halfSep);
    drawSingleTrackTies(from1, to1, tieDir, tiePerpDir, numTies);
  };

  // Draw ties for a single track along a curve
  const drawSingleCurveTies = (
    from: { x: number; y: number },
    to: { x: number; y: number },
    control: { x: number; y: number },
    fromTieDir: { x: number; y: number },
    toTieDir: { x: number; y: number },
    fromTiePerpDir: { x: number; y: number },
    toTiePerpDir: { x: number; y: number },
    numTies: number
  ) => {
    for (let i = 0; i < numTies; i++) {
      const t = (i + 0.5) / numTies;
      const u = 1 - t;
      const tieX = u * u * from.x + 2 * u * t * control.x + t * t * to.x;
      const tieY = u * u * from.y + 2 * u * t * control.y + t * t * to.y;
      // Interpolate tie direction
      const interpDir = { x: fromTieDir.x * u + toTieDir.x * t, y: fromTieDir.y * u + toTieDir.y * t };
      const interpLen = Math.hypot(interpDir.x, interpDir.y);
      const normTieDir = { x: interpDir.x / interpLen, y: interpDir.y / interpLen };
      // Interpolate perpendicular direction for tie thickness
      const interpPerpDir = { x: fromTiePerpDir.x * u + toTiePerpDir.x * t, y: fromTiePerpDir.y * u + toTiePerpDir.y * t };
      const interpPerpLen = Math.hypot(interpPerpDir.x, interpPerpDir.y);
      const normTiePerpDir = { x: interpPerpDir.x / interpPerpLen, y: interpPerpDir.y / interpPerpLen };
      drawTie(tieX, tieY, normTieDir, normTiePerpDir);
    }
  };

  // Draw ties for double track along a curve
  // Outer curves are longer than inner curves, so adjust tie counts accordingly
  const drawDoubleCurveTies = (
    from: { x: number; y: number },
    to: { x: number; y: number },
    control: { x: number; y: number },
    fromTieDir: { x: number; y: number },
    toTieDir: { x: number; y: number },
    fromTiePerpDir: { x: number; y: number },
    toTiePerpDir: { x: number; y: number },
    fromPerp: { x: number; y: number },
    toPerp: { x: number; y: number },
    curvePerp: { x: number; y: number },
    numTies: number
  ) => {
    // Track 0 is the outer curve (offset by +halfSep away from curve center)
    // It has a longer arc length, so use more ties
    const outerTies = numTies + 3;
    const from0 = offsetPoint(from, fromPerp, halfSep);
    const to0 = offsetPoint(to, toPerp, halfSep);
    const ctrl0 = offsetPoint(control, curvePerp, halfSep);
    drawSingleCurveTies(from0, to0, ctrl0, fromTieDir, toTieDir, fromTiePerpDir, toTiePerpDir, outerTies);
    // Track 1 is the inner curve (offset by -halfSep toward curve center)
    // It has a shorter arc length, so use fewer ties
    const innerTies = Math.max(3, numTies - 2);
    const from1 = offsetPoint(from, fromPerp, -halfSep);
    const to1 = offsetPoint(to, toPerp, -halfSep);
    const ctrl1 = offsetPoint(control, curvePerp, -halfSep);
    drawSingleCurveTies(from1, to1, ctrl1, fromTieDir, toTieDir, fromTiePerpDir, toTiePerpDir, innerTies);
  };

  const tiesHalf = Math.ceil(TIES_PER_TILE / 2);

  // For ties perpendicular to tracks:
  // N-S track: ties extend E-W (tieDir = ISO_EW), tie thickness along N-S (tiePerpDir = ISO_NS)
  // E-W track: ties extend N-S (tieDir = ISO_NS), tie thickness along E-W (tiePerpDir = ISO_EW)

  switch (trackType) {
    case 'straight_ns':
      // Track runs N-S, ties extend E-W, tie thickness along N-S
      drawDoubleTies(northEdge, southEdge, ISO_EW, ISO_NS, ISO_EW, TIES_PER_TILE);
      break;
    case 'straight_ew':
      // Track runs E-W, ties extend N-S, tie thickness along E-W
      drawDoubleTies(eastEdge, westEdge, ISO_NS, ISO_EW, ISO_NS, TIES_PER_TILE);
      break;
    case 'curve_ne':
      // At north: track is N-S, ties E-W; At east: track is E-W, ties N-S
      drawDoubleCurveTies(northEdge, eastEdge, center, ISO_EW, ISO_NS, ISO_NS, ISO_EW, ISO_EW, ISO_NS, { x: 0, y: 1 }, TIES_PER_TILE);
      break;
    case 'curve_nw':
      // At north: track is N-S, ties E-W; At west: track is E-W, ties N-S
      drawDoubleCurveTies(northEdge, westEdge, center, NEG_ISO_EW, ISO_NS, ISO_NS, ISO_EW, NEG_ISO_EW, ISO_NS, { x: 1, y: 0 }, TIES_PER_TILE);
      break;
    case 'curve_se':
      // At south: track is N-S, ties E-W; At east: track is E-W, ties N-S
      drawDoubleCurveTies(southEdge, eastEdge, center, ISO_EW, NEG_ISO_NS, NEG_ISO_NS, NEG_ISO_EW, ISO_EW, NEG_ISO_NS, { x: -1, y: 0 }, TIES_PER_TILE);
      break;
    case 'curve_sw':
      // At south: track is N-S, ties E-W; At west: track is E-W, ties N-S
      drawDoubleCurveTies(southEdge, westEdge, center, NEG_ISO_EW, NEG_ISO_NS, NEG_ISO_NS, NEG_ISO_EW, NEG_ISO_EW, NEG_ISO_NS, { x: 0, y: -1 }, TIES_PER_TILE);
      break;
    case 'junction_t_n':
      // Horizontal tracks (east-west): ties extend N-S
      drawDoubleTies(eastEdge, westEdge, ISO_NS, ISO_EW, ISO_NS, TIES_PER_TILE);
      // Curved connections from south to east and west
      drawDoubleCurveTies(southEdge, eastEdge, center, ISO_EW, NEG_ISO_NS, NEG_ISO_NS, NEG_ISO_EW, ISO_EW, NEG_ISO_NS, { x: -1, y: 0 }, TIES_PER_TILE);
      drawDoubleCurveTies(southEdge, westEdge, center, NEG_ISO_EW, NEG_ISO_NS, NEG_ISO_NS, NEG_ISO_EW, NEG_ISO_EW, NEG_ISO_NS, { x: 0, y: -1 }, TIES_PER_TILE);
      break;
    case 'junction_t_e':
      // Vertical tracks (north-south): ties extend E-W
      drawDoubleTies(northEdge, southEdge, ISO_EW, ISO_NS, ISO_EW, TIES_PER_TILE);
      // Curved connections from west to north and south
      drawDoubleCurveTies(westEdge, northEdge, center, ISO_NS, NEG_ISO_EW, ISO_EW, ISO_NS, ISO_NS, NEG_ISO_EW, { x: 1, y: 0 }, TIES_PER_TILE);
      drawDoubleCurveTies(westEdge, southEdge, center, NEG_ISO_NS, NEG_ISO_EW, NEG_ISO_EW, NEG_ISO_NS, NEG_ISO_NS, NEG_ISO_EW, { x: 0, y: -1 }, TIES_PER_TILE);
      break;
    case 'junction_t_s':
      // Horizontal tracks (east-west): ties extend N-S
      drawDoubleTies(eastEdge, westEdge, ISO_NS, ISO_EW, ISO_NS, TIES_PER_TILE);
      // Curved connections from north to east and west
      drawDoubleCurveTies(northEdge, eastEdge, center, ISO_EW, ISO_NS, ISO_NS, ISO_EW, ISO_EW, ISO_NS, { x: 0, y: 1 }, TIES_PER_TILE);
      drawDoubleCurveTies(northEdge, westEdge, center, NEG_ISO_EW, ISO_NS, ISO_NS, ISO_EW, NEG_ISO_EW, ISO_NS, { x: 1, y: 0 }, TIES_PER_TILE);
      break;
    case 'junction_t_w':
      // Vertical tracks (north-south): ties extend E-W
      drawDoubleTies(northEdge, southEdge, ISO_EW, ISO_NS, ISO_EW, TIES_PER_TILE);
      // Curved connections from east to north and south
      drawDoubleCurveTies(eastEdge, northEdge, center, ISO_NS, ISO_EW, ISO_EW, ISO_NS, ISO_NS, ISO_EW, { x: 0, y: 1 }, TIES_PER_TILE);
      drawDoubleCurveTies(eastEdge, southEdge, center, ISO_NS, NEG_ISO_EW, NEG_ISO_EW, NEG_ISO_NS, ISO_NS, NEG_ISO_EW, { x: 0, y: -1 }, TIES_PER_TILE);
      break;
    case 'junction_cross':
      drawDoubleTies(northEdge, southEdge, ISO_EW, ISO_NS, ISO_EW, TIES_PER_TILE);
      drawDoubleTies(eastEdge, westEdge, ISO_NS, ISO_EW, ISO_NS, TIES_PER_TILE);
      break;
    case 'terminus_n':
      drawDoubleTies(center, southEdge, ISO_EW, ISO_NS, ISO_EW, tiesHalf);
      break;
    case 'terminus_e':
      drawDoubleTies(center, westEdge, ISO_NS, ISO_EW, ISO_NS, tiesHalf);
      break;
    case 'terminus_s':
      drawDoubleTies(center, northEdge, ISO_EW, ISO_NS, ISO_EW, tiesHalf);
      break;
    case 'terminus_w':
      drawDoubleTies(center, eastEdge, ISO_NS, ISO_EW, ISO_NS, tiesHalf);
      break;
    case 'single': {
      // Draw ties for a short segment aligned with actual N-S tile axis
      const nsDirX = southEdge.x - northEdge.x;
      const nsDirY = southEdge.y - northEdge.y;
      const nsLen = Math.hypot(nsDirX, nsDirY);
      const nsDir = { x: nsDirX / nsLen, y: nsDirY / nsLen };
      
      // E-W perpendicular direction
      const ewDirX = westEdge.x - eastEdge.x;
      const ewDirY = westEdge.y - eastEdge.y;
      const ewLen = Math.hypot(ewDirX, ewDirY);
      const ewDir = { x: ewDirX / ewLen, y: ewDirY / ewLen };
      
      const singleStubLen = nsLen * 0.35;
      const singleFrom = { x: cx - nsDir.x * singleStubLen, y: cy - nsDir.y * singleStubLen };
      const singleTo = { x: cx + nsDir.x * singleStubLen, y: cy + nsDir.y * singleStubLen };
      // Ties extend E-W, tie thickness along N-S
      drawDoubleTies(singleFrom, singleTo, ewDir, nsDir, ewDir, 3);
      break;
    }
  }
}

/**
 * Draw steel rails for DOUBLE tracks
 */
function drawRails(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  trackType: TrackType,
  zoom: number
): void {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const railGauge = w * TRACK_GAUGE_RATIO;
  const railWidth = zoom >= 0.7 ? 0.85 : 0.7;
  const trackSep = w * TRACK_SEPARATION_RATIO;
  const halfSep = trackSep / 2;

  const northEdge = { x: x + w * 0.25, y: y + h * 0.25 };
  const eastEdge = { x: x + w * 0.75, y: y + h * 0.25 };
  const southEdge = { x: x + w * 0.75, y: y + h * 0.75 };
  const westEdge = { x: x + w * 0.25, y: y + h * 0.75 };
  const center = { x: cx, y: cy };

  const halfGauge = railGauge / 2;

  // Draw a single track's rail pair along a straight segment
  const drawSingleStraightRails = (
    from: { x: number; y: number },
    to: { x: number; y: number },
    perp: { x: number; y: number }
  ) => {
    ctx.strokeStyle = RAIL_COLORS.RAIL_SHADOW;
    ctx.lineWidth = railWidth + 0.3;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(from.x + perp.x * halfGauge + 0.3, from.y + perp.y * halfGauge + 0.3);
    ctx.lineTo(to.x + perp.x * halfGauge + 0.3, to.y + perp.y * halfGauge + 0.3);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(from.x - perp.x * halfGauge + 0.3, from.y - perp.y * halfGauge + 0.3);
    ctx.lineTo(to.x - perp.x * halfGauge + 0.3, to.y - perp.y * halfGauge + 0.3);
    ctx.stroke();

    ctx.strokeStyle = RAIL_COLORS.RAIL;
    ctx.lineWidth = railWidth;

    ctx.beginPath();
    ctx.moveTo(from.x + perp.x * halfGauge, from.y + perp.y * halfGauge);
    ctx.lineTo(to.x + perp.x * halfGauge, to.y + perp.y * halfGauge);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(from.x - perp.x * halfGauge, from.y - perp.y * halfGauge);
    ctx.lineTo(to.x - perp.x * halfGauge, to.y - perp.y * halfGauge);
    ctx.stroke();
  };

  // Draw double straight rails
  const drawDoubleStraightRails = (
    from: { x: number; y: number },
    to: { x: number; y: number },
    perp: { x: number; y: number }
  ) => {
    const from0 = offsetPoint(from, perp, halfSep);
    const to0 = offsetPoint(to, perp, halfSep);
    drawSingleStraightRails(from0, to0, perp);

    const from1 = offsetPoint(from, perp, -halfSep);
    const to1 = offsetPoint(to, perp, -halfSep);
    drawSingleStraightRails(from1, to1, perp);
  };

  // Draw a single track's curved rails
  const drawSingleCurvedRails = (
    from: { x: number; y: number },
    to: { x: number; y: number },
    control: { x: number; y: number },
    fromPerp: { x: number; y: number },
    toPerp: { x: number; y: number }
  ) => {
    const midPerp = { x: (fromPerp.x + toPerp.x) / 2, y: (fromPerp.y + toPerp.y) / 2 };
    const midLen = Math.hypot(midPerp.x, midPerp.y);
    const ctrlPerp = { x: midPerp.x / midLen, y: midPerp.y / midLen };

    ctx.strokeStyle = RAIL_COLORS.RAIL_SHADOW;
    ctx.lineWidth = railWidth + 0.3;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(from.x + fromPerp.x * halfGauge + 0.3, from.y + fromPerp.y * halfGauge + 0.3);
    ctx.quadraticCurveTo(
      control.x + ctrlPerp.x * halfGauge + 0.3, control.y + ctrlPerp.y * halfGauge + 0.3,
      to.x + toPerp.x * halfGauge + 0.3, to.y + toPerp.y * halfGauge + 0.3
    );
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(from.x - fromPerp.x * halfGauge + 0.3, from.y - fromPerp.y * halfGauge + 0.3);
    ctx.quadraticCurveTo(
      control.x - ctrlPerp.x * halfGauge + 0.3, control.y - ctrlPerp.y * halfGauge + 0.3,
      to.x - toPerp.x * halfGauge + 0.3, to.y - toPerp.y * halfGauge + 0.3
    );
    ctx.stroke();

    ctx.strokeStyle = RAIL_COLORS.RAIL;
    ctx.lineWidth = railWidth;

    ctx.beginPath();
    ctx.moveTo(from.x + fromPerp.x * halfGauge, from.y + fromPerp.y * halfGauge);
    ctx.quadraticCurveTo(
      control.x + ctrlPerp.x * halfGauge, control.y + ctrlPerp.y * halfGauge,
      to.x + toPerp.x * halfGauge, to.y + toPerp.y * halfGauge
    );
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(from.x - fromPerp.x * halfGauge, from.y - fromPerp.y * halfGauge);
    ctx.quadraticCurveTo(
      control.x - ctrlPerp.x * halfGauge, control.y - ctrlPerp.y * halfGauge,
      to.x - toPerp.x * halfGauge, to.y - toPerp.y * halfGauge
    );
    ctx.stroke();
  };

  // Draw double curved rails
  const drawDoubleCurvedRails = (
    from: { x: number; y: number },
    to: { x: number; y: number },
    control: { x: number; y: number },
    fromPerp: { x: number; y: number },
    toPerp: { x: number; y: number },
    curvePerp: { x: number; y: number }
  ) => {
    const from0 = offsetPoint(from, fromPerp, halfSep);
    const to0 = offsetPoint(to, toPerp, halfSep);
    const ctrl0 = offsetPoint(control, curvePerp, halfSep);
    drawSingleCurvedRails(from0, to0, ctrl0, fromPerp, toPerp);

    const from1 = offsetPoint(from, fromPerp, -halfSep);
    const to1 = offsetPoint(to, toPerp, -halfSep);
    const ctrl1 = offsetPoint(control, curvePerp, -halfSep);
    drawSingleCurvedRails(from1, to1, ctrl1, fromPerp, toPerp);
  };

  switch (trackType) {
    case 'straight_ns':
      drawDoubleStraightRails(northEdge, southEdge, ISO_EW);
      break;
    case 'straight_ew':
      drawDoubleStraightRails(eastEdge, westEdge, ISO_NS);
      break;
    case 'curve_ne':
      drawDoubleCurvedRails(northEdge, eastEdge, center, ISO_EW, ISO_NS, { x: 0, y: 1 });
      break;
    case 'curve_nw':
      drawDoubleCurvedRails(northEdge, westEdge, center, NEG_ISO_EW, ISO_NS, { x: 1, y: 0 });
      break;
    case 'curve_se':
      drawDoubleCurvedRails(southEdge, eastEdge, center, ISO_EW, NEG_ISO_NS, { x: -1, y: 0 });
      break;
    case 'curve_sw':
      drawDoubleCurvedRails(southEdge, westEdge, center, NEG_ISO_EW, NEG_ISO_NS, { x: 0, y: -1 });
      break;
    case 'junction_t_n':
      // Horizontal tracks (east-west)
      drawDoubleStraightRails(eastEdge, westEdge, ISO_NS);
      // Curved connections from south to east and west (no straight branch - curves provide the connection)
      drawDoubleCurvedRails(southEdge, eastEdge, center, ISO_EW, NEG_ISO_NS, { x: -1, y: 0 });
      drawDoubleCurvedRails(southEdge, westEdge, center, NEG_ISO_EW, NEG_ISO_NS, { x: 0, y: -1 });
      break;
    case 'junction_t_e':
      // Vertical tracks (north-south)
      drawDoubleStraightRails(northEdge, southEdge, ISO_EW);
      // Curved connections from west to north and south (no straight branch - curves provide the connection)
      // west-to-north is reversed curve_nw: use ISO_NS, NEG_ISO_EW, { x: 1, y: 0 }
      drawDoubleCurvedRails(westEdge, northEdge, center, ISO_NS, NEG_ISO_EW, { x: 1, y: 0 });
      drawDoubleCurvedRails(westEdge, southEdge, center, NEG_ISO_NS, NEG_ISO_EW, { x: 0, y: -1 });
      break;
    case 'junction_t_s':
      // Horizontal tracks (east-west)
      drawDoubleStraightRails(eastEdge, westEdge, ISO_NS);
      // Curved connections from north to east and west (no straight branch - curves provide the connection)
      drawDoubleCurvedRails(northEdge, eastEdge, center, ISO_EW, ISO_NS, { x: 0, y: 1 });
      drawDoubleCurvedRails(northEdge, westEdge, center, NEG_ISO_EW, ISO_NS, { x: 1, y: 0 });
      break;
    case 'junction_t_w':
      // Vertical tracks (north-south)
      drawDoubleStraightRails(northEdge, southEdge, ISO_EW);
      // Curved connections from east to north and south (no straight branch - curves provide the connection)
      drawDoubleCurvedRails(eastEdge, northEdge, center, ISO_NS, ISO_EW, { x: 0, y: 1 });
      drawDoubleCurvedRails(eastEdge, southEdge, center, ISO_NS, NEG_ISO_EW, { x: 0, y: -1 });
      break;
    case 'junction_cross':
      drawDoubleStraightRails(northEdge, southEdge, ISO_EW);
      drawDoubleStraightRails(eastEdge, westEdge, ISO_NS);
      break;
    case 'terminus_n':
      drawDoubleStraightRails(center, southEdge, ISO_EW);
      drawBufferStop(ctx, cx + ISO_EW.x * halfSep, cy + ISO_EW.y * halfSep, 'north', zoom);
      drawBufferStop(ctx, cx - ISO_EW.x * halfSep, cy - ISO_EW.y * halfSep, 'north', zoom);
      break;
    case 'terminus_e':
      drawDoubleStraightRails(center, westEdge, ISO_NS);
      drawBufferStop(ctx, cx + ISO_NS.x * halfSep, cy + ISO_NS.y * halfSep, 'east', zoom);
      drawBufferStop(ctx, cx - ISO_NS.x * halfSep, cy - ISO_NS.y * halfSep, 'east', zoom);
      break;
    case 'terminus_s':
      drawDoubleStraightRails(center, northEdge, ISO_EW);
      drawBufferStop(ctx, cx + ISO_EW.x * halfSep, cy + ISO_EW.y * halfSep, 'south', zoom);
      drawBufferStop(ctx, cx - ISO_EW.x * halfSep, cy - ISO_EW.y * halfSep, 'south', zoom);
      break;
    case 'terminus_w':
      drawDoubleStraightRails(center, eastEdge, ISO_NS);
      drawBufferStop(ctx, cx + ISO_NS.x * halfSep, cy + ISO_NS.y * halfSep, 'west', zoom);
      drawBufferStop(ctx, cx - ISO_NS.x * halfSep, cy - ISO_NS.y * halfSep, 'west', zoom);
      break;
    case 'single': {
      // Draw rails for a short segment aligned with actual N-S tile axis
      const nsDirX = southEdge.x - northEdge.x;
      const nsDirY = southEdge.y - northEdge.y;
      const nsLen = Math.hypot(nsDirX, nsDirY);
      const nsDir = { x: nsDirX / nsLen, y: nsDirY / nsLen };
      
      // E-W perpendicular direction
      const ewDirX = westEdge.x - eastEdge.x;
      const ewDirY = westEdge.y - eastEdge.y;
      const ewLen = Math.hypot(ewDirX, ewDirY);
      const ewDir = { x: ewDirX / ewLen, y: ewDirY / ewLen };
      
      const stubLen = nsLen * 0.35;
      const singleFrom = { x: cx - nsDir.x * stubLen, y: cy - nsDir.y * stubLen };
      const singleTo = { x: cx + nsDir.x * stubLen, y: cy + nsDir.y * stubLen };
      drawDoubleStraightRails(singleFrom, singleTo, ewDir);
      break;
    }
  }
}

/**
 * Draw a buffer stop at track terminus (smaller for double track)
 */
function drawBufferStop(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  facing: 'north' | 'east' | 'south' | 'west',
  zoom: number
): void {
  if (zoom < 0.6) return;

  const size = 2.5;
  const offset = 1.5;

  ctx.save();
  ctx.translate(x, y);

  // Rotate based on facing direction
  const rotations = {
    north: -Math.PI * 0.75,
    east: -Math.PI * 0.25,
    south: Math.PI * 0.25,
    west: Math.PI * 0.75,
  };
  ctx.rotate(rotations[facing]);

  // Draw buffer stop (red/white striped)
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(-size - offset, -size / 2, size, size);
  
  // White stripe (vertical - rotated 90° from before)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-size - offset + size / 4, -size / 2, size / 2, size);

  ctx.restore();
}

// ============================================================================
// Main Track Drawing Function
// ============================================================================

/**
 * Draw complete rail track at a tile position
 * This should be called AFTER the base tile is drawn
 */
export function drawRailTrack(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  gridX: number,
  gridY: number,
  grid: Tile[][],
  gridSize: number,
  zoom: number
): void {
  // Get adjacent rail connections
  const connections = getAdjacentRail(grid, gridSize, gridX, gridY);
  
  // Determine track type
  const trackType = getTrackType(connections);

  // Draw layers in order: ballast (bottom), ties, rails (top)
  drawBallast(ctx, x, y, trackType, zoom);
  drawTies(ctx, x, y, trackType, zoom);
  drawRails(ctx, x, y, trackType, zoom);
}

/**
 * Get adjacent rail connections for a combined rail+road tile
 * Checks for both pure rail tiles AND road tiles with rail overlay
 */
export function getAdjacentRailForOverlay(
  grid: Tile[][],
  gridSize: number,
  x: number,
  y: number
): RailConnection {
  const hasRailAt = (checkX: number, checkY: number): boolean => {
    if (checkX < 0 || checkY < 0 || checkX >= gridSize || checkY >= gridSize) return false;
    const tile = grid[checkY][checkX];
    // Consider a tile as having rail if it's a rail tile, a rail station (any tile), road with rail overlay, or rail bridge
    return tile.building.type === 'rail' || 
           isRailStationTile(grid, gridSize, checkX, checkY) || 
           (tile.building.type === 'road' && tile.hasRailOverlay === true) ||
           (tile.building.type === 'bridge' && tile.building.bridgeTrackType === 'rail');
  };

  return {
    north: hasRailAt(x - 1, y),
    east: hasRailAt(x, y - 1),
    south: hasRailAt(x + 1, y),
    west: hasRailAt(x, y + 1),
  };
}

/**
 * Draw rail tracks only (inset rails, no ties or ballast) for overlay on roads
 * This is used when rail is overlaid on a road tile - the road provides the base
 */
export function drawRailTracksOnly(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  gridX: number,
  gridY: number,
  grid: Tile[][],
  gridSize: number,
  zoom: number
): void {
  // Get adjacent rail connections (including road+rail combined tiles)
  const connections = getAdjacentRailForOverlay(grid, gridSize, gridX, gridY);
  
  // Determine track type
  const trackType = getTrackType(connections);

  // Draw inset rails only (no ties) - rails are embedded in the road
  drawInsetRails(ctx, x, y, trackType, zoom);
}

/**
 * Draw inset rails for road overlays - darker borders to look embedded
 */
function drawInsetRails(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  trackType: TrackType,
  zoom: number
): void {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const railGauge = w * TRACK_GAUGE_RATIO;
  const railWidth = zoom >= 0.7 ? 0.85 : 0.7;
  const insetWidth = railWidth + 0.8; // Darker border for inset effect on streets
  const trackSep = w * TRACK_SEPARATION_RATIO;
  const halfSep = trackSep / 2;

  const northEdge = { x: x + w * 0.25, y: y + h * 0.25 };
  const eastEdge = { x: x + w * 0.75, y: y + h * 0.25 };
  const southEdge = { x: x + w * 0.75, y: y + h * 0.75 };
  const westEdge = { x: x + w * 0.25, y: y + h * 0.75 };
  const center = { x: cx, y: cy };

  const halfGauge = railGauge / 2;
  
  const INSET_DARK = '#101010';  // Darker border for better visibility on streets
  const RAIL_SILVER = '#7a7a7a'; // Slightly lighter silver for road rails

  // Draw a single track's inset rail pair along a straight segment
  const drawSingleStraightInsetRails = (
    from: { x: number; y: number },
    to: { x: number; y: number },
    perp: { x: number; y: number }
  ) => {
    // Draw dark inset borders first
    ctx.strokeStyle = INSET_DARK;
    ctx.lineWidth = insetWidth;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(from.x + perp.x * halfGauge, from.y + perp.y * halfGauge);
    ctx.lineTo(to.x + perp.x * halfGauge, to.y + perp.y * halfGauge);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(from.x - perp.x * halfGauge, from.y - perp.y * halfGauge);
    ctx.lineTo(to.x - perp.x * halfGauge, to.y - perp.y * halfGauge);
    ctx.stroke();

    // Draw silver rails on top
    ctx.strokeStyle = RAIL_SILVER;
    ctx.lineWidth = railWidth;

    ctx.beginPath();
    ctx.moveTo(from.x + perp.x * halfGauge, from.y + perp.y * halfGauge);
    ctx.lineTo(to.x + perp.x * halfGauge, to.y + perp.y * halfGauge);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(from.x - perp.x * halfGauge, from.y - perp.y * halfGauge);
    ctx.lineTo(to.x - perp.x * halfGauge, to.y - perp.y * halfGauge);
    ctx.stroke();
  };

  // Draw double straight inset rails
  const drawDoubleStraightInsetRails = (
    from: { x: number; y: number },
    to: { x: number; y: number },
    perp: { x: number; y: number }
  ) => {
    const from0 = offsetPoint(from, perp, halfSep);
    const to0 = offsetPoint(to, perp, halfSep);
    drawSingleStraightInsetRails(from0, to0, perp);

    const from1 = offsetPoint(from, perp, -halfSep);
    const to1 = offsetPoint(to, perp, -halfSep);
    drawSingleStraightInsetRails(from1, to1, perp);
  };

  // Draw a single track's curved inset rails
  const drawSingleCurvedInsetRails = (
    from: { x: number; y: number },
    to: { x: number; y: number },
    control: { x: number; y: number },
    fromPerp: { x: number; y: number },
    toPerp: { x: number; y: number }
  ) => {
    const midPerp = { x: (fromPerp.x + toPerp.x) / 2, y: (fromPerp.y + toPerp.y) / 2 };
    const midLen = Math.hypot(midPerp.x, midPerp.y);
    const ctrlPerp = { x: midPerp.x / midLen, y: midPerp.y / midLen };

    // Draw dark inset borders first
    ctx.strokeStyle = INSET_DARK;
    ctx.lineWidth = insetWidth;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(from.x + fromPerp.x * halfGauge, from.y + fromPerp.y * halfGauge);
    ctx.quadraticCurveTo(
      control.x + ctrlPerp.x * halfGauge, control.y + ctrlPerp.y * halfGauge,
      to.x + toPerp.x * halfGauge, to.y + toPerp.y * halfGauge
    );
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(from.x - fromPerp.x * halfGauge, from.y - fromPerp.y * halfGauge);
    ctx.quadraticCurveTo(
      control.x - ctrlPerp.x * halfGauge, control.y - ctrlPerp.y * halfGauge,
      to.x - toPerp.x * halfGauge, to.y - toPerp.y * halfGauge
    );
    ctx.stroke();

    // Draw silver rails on top
    ctx.strokeStyle = RAIL_SILVER;
    ctx.lineWidth = railWidth;

    ctx.beginPath();
    ctx.moveTo(from.x + fromPerp.x * halfGauge, from.y + fromPerp.y * halfGauge);
    ctx.quadraticCurveTo(
      control.x + ctrlPerp.x * halfGauge, control.y + ctrlPerp.y * halfGauge,
      to.x + toPerp.x * halfGauge, to.y + toPerp.y * halfGauge
    );
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(from.x - fromPerp.x * halfGauge, from.y - fromPerp.y * halfGauge);
    ctx.quadraticCurveTo(
      control.x - ctrlPerp.x * halfGauge, control.y - ctrlPerp.y * halfGauge,
      to.x - toPerp.x * halfGauge, to.y - toPerp.y * halfGauge
    );
    ctx.stroke();
  };

  // Draw double curved inset rails
  const drawDoubleCurvedInsetRails = (
    from: { x: number; y: number },
    to: { x: number; y: number },
    control: { x: number; y: number },
    fromPerp: { x: number; y: number },
    toPerp: { x: number; y: number },
    curvePerp: { x: number; y: number }
  ) => {
    const from0 = offsetPoint(from, fromPerp, halfSep);
    const to0 = offsetPoint(to, toPerp, halfSep);
    const ctrl0 = offsetPoint(control, curvePerp, halfSep);
    drawSingleCurvedInsetRails(from0, to0, ctrl0, fromPerp, toPerp);

    const from1 = offsetPoint(from, fromPerp, -halfSep);
    const to1 = offsetPoint(to, toPerp, -halfSep);
    const ctrl1 = offsetPoint(control, curvePerp, -halfSep);
    drawSingleCurvedInsetRails(from1, to1, ctrl1, fromPerp, toPerp);
  };

  switch (trackType) {
    case 'straight_ns':
      drawDoubleStraightInsetRails(northEdge, southEdge, ISO_EW);
      break;
    case 'straight_ew':
      drawDoubleStraightInsetRails(eastEdge, westEdge, ISO_NS);
      break;
    case 'curve_ne':
      drawDoubleCurvedInsetRails(northEdge, eastEdge, center, ISO_EW, ISO_NS, { x: 0, y: 1 });
      break;
    case 'curve_nw':
      drawDoubleCurvedInsetRails(northEdge, westEdge, center, NEG_ISO_EW, ISO_NS, { x: 1, y: 0 });
      break;
    case 'curve_se':
      drawDoubleCurvedInsetRails(southEdge, eastEdge, center, ISO_EW, NEG_ISO_NS, { x: -1, y: 0 });
      break;
    case 'curve_sw':
      drawDoubleCurvedInsetRails(southEdge, westEdge, center, NEG_ISO_EW, NEG_ISO_NS, { x: 0, y: -1 });
      break;
    case 'junction_t_n':
      drawDoubleStraightInsetRails(eastEdge, westEdge, ISO_NS);
      drawDoubleCurvedInsetRails(southEdge, eastEdge, center, ISO_EW, NEG_ISO_NS, { x: -1, y: 0 });
      drawDoubleCurvedInsetRails(southEdge, westEdge, center, NEG_ISO_EW, NEG_ISO_NS, { x: 0, y: -1 });
      break;
    case 'junction_t_e':
      drawDoubleStraightInsetRails(northEdge, southEdge, ISO_EW);
      drawDoubleCurvedInsetRails(westEdge, northEdge, center, ISO_NS, NEG_ISO_EW, { x: 1, y: 0 });
      drawDoubleCurvedInsetRails(westEdge, southEdge, center, NEG_ISO_NS, NEG_ISO_EW, { x: 0, y: -1 });
      break;
    case 'junction_t_s':
      drawDoubleStraightInsetRails(eastEdge, westEdge, ISO_NS);
      drawDoubleCurvedInsetRails(northEdge, eastEdge, center, ISO_EW, ISO_NS, { x: 0, y: 1 });
      drawDoubleCurvedInsetRails(northEdge, westEdge, center, NEG_ISO_EW, ISO_NS, { x: 1, y: 0 });
      break;
    case 'junction_t_w':
      drawDoubleStraightInsetRails(northEdge, southEdge, ISO_EW);
      drawDoubleCurvedInsetRails(eastEdge, northEdge, center, ISO_NS, ISO_EW, { x: 0, y: 1 });
      drawDoubleCurvedInsetRails(eastEdge, southEdge, center, ISO_NS, NEG_ISO_EW, { x: 0, y: -1 });
      break;
    case 'junction_cross':
      drawDoubleStraightInsetRails(northEdge, southEdge, ISO_EW);
      drawDoubleStraightInsetRails(eastEdge, westEdge, ISO_NS);
      break;
    case 'terminus_n':
      drawDoubleStraightInsetRails(center, southEdge, ISO_EW);
      break;
    case 'terminus_e':
      drawDoubleStraightInsetRails(center, westEdge, ISO_NS);
      break;
    case 'terminus_s':
      drawDoubleStraightInsetRails(center, northEdge, ISO_EW);
      break;
    case 'terminus_w':
      drawDoubleStraightInsetRails(center, eastEdge, ISO_NS);
      break;
    case 'single': {
      const nsDirX = southEdge.x - northEdge.x;
      const nsDirY = southEdge.y - northEdge.y;
      const nsLen = Math.hypot(nsDirX, nsDirY);
      const nsDir = { x: nsDirX / nsLen, y: nsDirY / nsLen };
      
      const ewDirX = westEdge.x - eastEdge.x;
      const ewDirY = westEdge.y - eastEdge.y;
      const ewLen = Math.hypot(ewDirX, ewDirY);
      const ewDir = { x: ewDirX / ewLen, y: ewDirY / ewLen };
      
      const stubLen = nsLen * 0.35;
      const singleFrom = { x: cx - nsDir.x * stubLen, y: cy - nsDir.y * stubLen };
      const singleTo = { x: cx + nsDir.x * stubLen, y: cy + nsDir.y * stubLen };
      drawDoubleStraightInsetRails(singleFrom, singleTo, ewDir);
      break;
    }
  }
}

// ============================================================================
// Railroad Crossing Types and Detection
// ============================================================================

/** Railroad crossing state */
export type CrossingState = 'open' | 'warning' | 'closed';

/** Railroad crossing information */
export interface RailroadCrossing {
  tileX: number;
  tileY: number;
  state: CrossingState;
  gateAngle: number; // 0 = up (open), 90 = down (closed)
  flashTimer: number; // For alternating lights
  trainApproaching: boolean;
  trainDistance: number; // Distance in tiles to nearest approaching train
}

/** Detection radius for triggering crossing warning */
export const CROSSING_WARNING_DISTANCE = 3; // tiles

/** Gate animation speed (degrees per second) */
export const GATE_ANIMATION_SPEED = 180; // Takes 0.5s to close/open

/** Crossing light flash interval */
export const CROSSING_FLASH_INTERVAL = 0.5; // seconds

/**
 * Check if a tile has road at position (for crossing detection)
 */
function hasRoadAtPosition(grid: Tile[][], gridSize: number, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) return false;
  return grid[y][x].building.type === 'road';
}

/**
 * Get road direction at a tile (NS, EW, or intersection)
 */
function getRoadDirection(grid: Tile[][], gridSize: number, x: number, y: number): 'ns' | 'ew' | 'intersection' | 'none' {
  if (!hasRoadAtPosition(grid, gridSize, x, y)) return 'none';
  
  const hasNorth = hasRoadAtPosition(grid, gridSize, x - 1, y);
  const hasSouth = hasRoadAtPosition(grid, gridSize, x + 1, y);
  const hasEast = hasRoadAtPosition(grid, gridSize, x, y - 1);
  const hasWest = hasRoadAtPosition(grid, gridSize, x, y + 1);
  
  const hasNS = hasNorth || hasSouth;
  const hasEW = hasEast || hasWest;
  
  if (hasNS && hasEW) return 'intersection';
  if (hasNS) return 'ns';
  if (hasEW) return 'ew';
  return 'none'; // Isolated road tile
}

/**
 * Check if a tile is a railroad crossing (road with rail overlay where rail crosses road perpendicularly)
 * Returns false if rail runs parallel to road direction
 */
export function isRailroadCrossing(grid: Tile[][], gridSize: number, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) return false;
  const tile = grid[y][x];
  
  // Must be a road with rail overlay
  if (tile.building.type !== 'road' || !tile.hasRailOverlay) return false;
  
  // Get road and rail directions
  const roadDir = getRoadDirection(grid, gridSize, x, y);
  const railConnections = getAdjacentRailForOverlay(grid, gridSize, x, y);
  
  const railHasNS = railConnections.north || railConnections.south;
  const railHasEW = railConnections.east || railConnections.west;
  
  // If road is an intersection, always consider it a crossing
  if (roadDir === 'intersection') return true;
  
  // If rail crosses in both directions, it's a crossing
  if (railHasNS && railHasEW) return true;
  
  // Check if rail is perpendicular to road
  // Road runs NS -> rail should run EW for a crossing
  // Road runs EW -> rail should run NS for a crossing
  if (roadDir === 'ns' && railHasEW && !railHasNS) return true;
  if (roadDir === 'ew' && railHasNS && !railHasEW) return true;
  
  // Rail runs parallel to road - not a perpendicular crossing
  return false;
}

/**
 * Find all railroad crossings in the grid
 */
export function findRailroadCrossings(grid: Tile[][], gridSize: number): { x: number; y: number }[] {
  const crossings: { x: number; y: number }[] = [];
  
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      if (isRailroadCrossing(grid, gridSize, x, y)) {
        crossings.push({ x, y });
      }
    }
  }
  
  return crossings;
}

/**
 * Get the rail track orientation at a crossing (NS or EW)
 */
export function getCrossingRailOrientation(
  grid: Tile[][],
  gridSize: number,
  x: number,
  y: number
): 'ns' | 'ew' | 'cross' {
  const connections = getAdjacentRailForOverlay(grid, gridSize, x, y);
  const hasNS = connections.north || connections.south;
  const hasEW = connections.east || connections.west;
  
  if (hasNS && hasEW) return 'cross';
  if (hasNS) return 'ns';
  return 'ew';
}

// ============================================================================
// Railroad Crossing Drawing Functions
// ============================================================================

/** Crossing signal colors */
export const CROSSING_COLORS = {
  POLE: '#374151',           // Dark gray pole
  LIGHT_OFF: '#1f2937',      // Inactive light
  LIGHT_RED: '#ef4444',      // Active red light
  GATE_POLE: '#4b5563',      // Gate arm support
  GATE_ARM: '#fbbf24',       // Yellow/orange gate arm
  GATE_STRIPE: '#1f2937',    // Black stripes on gate
  BASE: '#6b7280',           // Concrete base
};

/**
 * Draw a railroad crossing signal (pole with flashing lights, no crossbuck)
 */
export function drawCrossingSignal(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  position: 'nw' | 'ne' | 'sw' | 'se',
  flashTimer: number,
  isActive: boolean,
  zoom: number
): void {
  if (zoom < 0.5) return;
  
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  
  // Position signals at corners of the tile (on sidewalk area)
  // Left signals (nw, sw) moved down 0.1, right signals (ne, se) moved up 0.1
  const offsets = {
    nw: { x: w * 0.12, y: h * 0.48 },  // moved down
    ne: { x: w * 0.52, y: h * 0.02 },  // moved up
    sw: { x: w * 0.48, y: h * 0.98 },  // moved down
    se: { x: w * 0.88, y: h * 0.52 },  // moved up
  };
  
  const offset = offsets[position];
  const signalX = x + offset.x;
  const signalY = y + offset.y;
  
  const scale = (zoom >= 0.8 ? 1 : 0.85) * 0.7; // 30% smaller
  const poleHeight = 14 * scale;
  const lightSize = 2.5 * scale;
  const lightSpacing = 5 * scale;
  
  // Draw pole
  ctx.strokeStyle = CROSSING_COLORS.POLE;
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.moveTo(signalX, signalY);
  ctx.lineTo(signalX, signalY - poleHeight);
  ctx.stroke();
  
  // Draw flashing lights (two alternating red lights) at top of pole
  const lightsY = signalY - poleHeight + 4 * scale;
  const flashOn = Math.floor(flashTimer / CROSSING_FLASH_INTERVAL) % 2 === 0;
  
  // Left light
  ctx.fillStyle = isActive && flashOn ? CROSSING_COLORS.LIGHT_RED : CROSSING_COLORS.LIGHT_OFF;
  ctx.beginPath();
  ctx.arc(signalX - lightSpacing * 0.5, lightsY, lightSize, 0, Math.PI * 2);
  ctx.fill();
  
  // Right light (alternate flash)
  ctx.fillStyle = isActive && !flashOn ? CROSSING_COLORS.LIGHT_RED : CROSSING_COLORS.LIGHT_OFF;
  ctx.beginPath();
  ctx.arc(signalX + lightSpacing * 0.5, lightsY, lightSize, 0, Math.PI * 2);
  ctx.fill();
  
  // Add glow effect when lights are on
  if (isActive && zoom >= 0.7) {
    ctx.save();
    ctx.shadowColor = CROSSING_COLORS.LIGHT_RED;
    ctx.shadowBlur = 8 * scale;
    ctx.fillStyle = CROSSING_COLORS.LIGHT_RED;
    if (flashOn) {
      ctx.beginPath();
      ctx.arc(signalX - lightSpacing * 0.5, lightsY, lightSize, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(signalX + lightSpacing * 0.5, lightsY, lightSize, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

/**
 * Draw a railroad crossing gate arm
 * Gate goes straight up when open (angle=0) and down when closed (angle=90)
 * @param swingDirOverride - Optional override for swing direction (1 = right, -1 = left)
 * @param tiltOverride - Optional override for tilt angle when closed
 */
export function drawCrossingGate(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  position: 'nw' | 'ne' | 'sw' | 'se',
  gateAngle: number, // 0 = up (open), 90 = down (closed)
  zoom: number,
  swingDirOverride?: number,
  tiltOverride?: number
): void {
  if (zoom < 0.6) return;
  
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  
  // Position gates at corners (same as signals but slightly offset)
  // Direction: default swing directions, can be overridden
  // Tilt: top gates (nw, ne) tilt up when closed, bottom gates (sw, se) tilt down when closed
  // Left gates moved down 0.1, right gates moved up 0.1
  const offsets = {
    nw: { x: w * 0.15, y: h * 0.50, dir: 1, tilt: -30 },   // default swings right, tilts up
    ne: { x: w * 0.55, y: h * 0.05, dir: -1, tilt: -30 },  // default swings left, tilts up
    sw: { x: w * 0.45, y: h * 0.95, dir: 1, tilt: 30 },    // default swings right, tilts down
    se: { x: w * 0.85, y: h * 0.50, dir: -1, tilt: 30 },   // default swings left, tilts down
  };
  
  const offset = offsets[position];
  const gateX = x + offset.x;
  const gateY = y + offset.y;
  
  const scale = zoom >= 0.8 ? 1 : 0.85;
  const gateLength = 18 * scale;
  const gateWidth = 1.1 * scale;
  
  // Calculate gate end position based on angle
  // angle 0 = straight up (vertical)
  // angle 90 = horizontal (blocking road), but with tilt adjustment
  // Tilt is applied progressively as the gate closes
  const tilt = tiltOverride ?? offset.tilt;
  const tiltAmount = (gateAngle / 90) * tilt; // Gradually apply tilt as gate closes
  const effectiveAngle = gateAngle + tiltAmount;
  const angleRad = effectiveAngle * Math.PI / 180;
  
  // When open (angle=0): gate points straight up (-Y direction)
  // When closed (angle=90): gate extends with tilt (up for top gates, down for bottom gates)
  // dir determines which way the gate swings (left or right), can be overridden
  const swingDir = swingDirOverride ?? offset.dir;
  const gateEndX = gateX + swingDir * Math.sin(angleRad) * gateLength;
  const gateEndY = gateY - Math.cos(angleRad) * gateLength;
  
  ctx.save();
  
  // Draw gate arm using a rotated rectangle for better appearance
  const dx = gateEndX - gateX;
  const dy = gateEndY - gateY;
  const len = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);
  
  ctx.translate(gateX, gateY);
  ctx.rotate(angle);
  
  // Draw yellow base of gate arm
  ctx.fillStyle = CROSSING_COLORS.GATE_ARM;
  ctx.fillRect(0, -gateWidth / 2, len, gateWidth);
  
  // Draw black stripes (thinner than before for better look)
  ctx.fillStyle = CROSSING_COLORS.GATE_STRIPE;
  const stripeCount = 4;
  const stripeWidth = len / (stripeCount * 2);
  for (let i = 0; i < stripeCount; i++) {
    ctx.fillRect(stripeWidth * (i * 2 + 1), -gateWidth / 2, stripeWidth * 0.7, gateWidth);
  }
  
  ctx.restore();
  
  // Draw pivot point (small circle at base)
  ctx.fillStyle = CROSSING_COLORS.GATE_POLE;
  ctx.beginPath();
  ctx.arc(gateX, gateY, gateWidth * 0.7, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Draw complete railroad crossing visuals for a tile
 */
export function drawRailroadCrossing(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  gridX: number,
  gridY: number,
  grid: Tile[][],
  gridSize: number,
  zoom: number,
  flashTimer: number,
  gateAngle: number,
  isActive: boolean
): void {
  // Determine rail orientation to place signals/gates appropriately
  const orientation = getCrossingRailOrientation(grid, gridSize, gridX, gridY);
  
  // For NS tracks (rail goes top-left to bottom-right): signals on NE and SW corners
  // For EW tracks (rail goes top-right to bottom-left): signals on NW and SE corners
  // For cross: all four corners
  
  if (orientation === 'cross') {
    // All four corners for cross tracks
    drawCrossingSignal(ctx, x, y, 'ne', flashTimer, isActive, zoom);
    drawCrossingSignal(ctx, x, y, 'sw', flashTimer, isActive, zoom);
    drawCrossingSignal(ctx, x, y, 'nw', flashTimer, isActive, zoom);
    drawCrossingSignal(ctx, x, y, 'se', flashTimer, isActive, zoom);
    
    if (zoom >= 0.7) {
      drawCrossingGate(ctx, x, y, 'ne', gateAngle, zoom);
      drawCrossingGate(ctx, x, y, 'sw', gateAngle, zoom);
      drawCrossingGate(ctx, x, y, 'nw', gateAngle, zoom);
      drawCrossingGate(ctx, x, y, 'se', gateAngle, zoom);
    }
  } else if (orientation === 'ns') {
    // NS rail (goes top-left to bottom-right) - gates on NE and SW to block EW road traffic
    drawCrossingSignal(ctx, x, y, 'ne', flashTimer, isActive, zoom);
    drawCrossingSignal(ctx, x, y, 'sw', flashTimer, isActive, zoom);
    
    if (zoom >= 0.7) {
      // NE swings right with down tilt, SW swings left with up tilt
      drawCrossingGate(ctx, x, y, 'ne', gateAngle, zoom, 1, 30);   // tilt down
      drawCrossingGate(ctx, x, y, 'sw', gateAngle, zoom, -1, -30); // tilt up
    }
  } else {
    // EW rail (goes top-right to bottom-left) - gates on NW and SE to block NS road traffic
    drawCrossingSignal(ctx, x, y, 'nw', flashTimer, isActive, zoom);
    drawCrossingSignal(ctx, x, y, 'se', flashTimer, isActive, zoom);
    
    if (zoom >= 0.7) {
      // Use default swing directions (nw swings right, se swings left - both toward center)
      drawCrossingGate(ctx, x, y, 'nw', gateAngle, zoom);
      drawCrossingGate(ctx, x, y, 'se', gateAngle, zoom);
    }
  }
}

// ============================================================================
// Train Pathfinding Functions
// ============================================================================

/**
 * Get available direction options from a rail tile
 * Recognizes both pure rail tiles AND road tiles with rail overlay
 */
export function getRailDirectionOptions(
  grid: Tile[][],
  gridSize: number,
  x: number,
  y: number
): CarDirection[] {
  const options: CarDirection[] = [];
  if (hasRailAtPosition(grid, gridSize, x - 1, y)) options.push('north');
  if (hasRailAtPosition(grid, gridSize, x, y - 1)) options.push('east');
  if (hasRailAtPosition(grid, gridSize, x + 1, y)) options.push('south');
  if (hasRailAtPosition(grid, gridSize, x, y + 1)) options.push('west');
  return options;
}

/**
 * Find all rail stations in the grid
 */
export function findRailStations(
  grid: Tile[][],
  gridSize: number
): { x: number; y: number }[] {
  const stations: { x: number; y: number }[] = [];
  
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      if (grid[y][x].building.type === 'rail_station') {
        stations.push({ x, y });
      }
    }
  }
  
  return stations;
}

/**
 * Count rail tiles in the grid (includes pure rail tiles, road tiles with rail overlay, AND rail bridges)
 */
export function countRailTiles(
  grid: Tile[][],
  gridSize: number
): number {
  let count = 0;
  
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const tile = grid[y][x];
      if (tile.building.type === 'rail' || 
          (tile.building.type === 'road' && tile.hasRailOverlay === true) ||
          (tile.building.type === 'bridge' && tile.building.bridgeTrackType === 'rail')) {
        count++;
      }
    }
  }
  
  return count;
}

/**
 * Check if a train is approaching or at a specific tile
 * Used for railroad crossing activation
 * @param trains - Array of all active trains
 * @param tileX - Target tile X coordinate
 * @param tileY - Target tile Y coordinate
 * @param warningDistance - How many tiles away to trigger warning
 * @returns Object with isApproaching flag and distance to nearest train
 */
export function isTrainApproachingTile(
  trains: { 
    tileX: number; 
    tileY: number; 
    direction: CarDirection; 
    progress: number;
    carriages: { tileX: number; tileY: number }[];
  }[],
  tileX: number,
  tileY: number,
  warningDistance: number = CROSSING_WARNING_DISTANCE
): { isApproaching: boolean; distance: number; isOccupied: boolean } {
  let minDistance = Infinity;
  let isOccupied = false;
  
  for (const train of trains) {
    // Check locomotive position
    const locoDist = Math.abs(train.tileX - tileX) + Math.abs(train.tileY - tileY);
    
    // Check if train is directly on the crossing
    if (train.tileX === tileX && train.tileY === tileY) {
      isOccupied = true;
      minDistance = 0;
    }
    
    // Check all carriages
    for (const carriage of train.carriages) {
      if (carriage.tileX === tileX && carriage.tileY === tileY) {
        isOccupied = true;
        minDistance = 0;
      }
    }
    
    // Calculate effective distance considering direction
    // A train approaching the crossing is more important than one moving away
    const dirMeta: Record<CarDirection, { dx: number; dy: number }> = {
      north: { dx: -1, dy: 0 },
      east: { dx: 0, dy: -1 },
      south: { dx: 1, dy: 0 },
      west: { dx: 0, dy: 1 },
    };
    
    const dir = dirMeta[train.direction];
    
    // Project train's path to see if it will reach the crossing
    // Check if the crossing is generally in the direction the train is heading
    const toTargetX = tileX - train.tileX;
    const toTargetY = tileY - train.tileY;
    
    // Dot product to see if target is ahead of train
    const dotProduct = toTargetX * dir.dx + toTargetY * dir.dy;
    
    if (dotProduct > 0) {
      // Target is ahead of train - this train is approaching
      // Calculate distance accounting for progress
      const effectiveDistance = locoDist - train.progress;
      minDistance = Math.min(minDistance, Math.max(0, effectiveDistance));
    }
  }
  
  return {
    isApproaching: minDistance <= warningDistance,
    distance: minDistance,
    isOccupied,
  };
}

/**
 * Get the crossing state based on train proximity
 */
export function getCrossingStateForTile(
  trains: { 
    tileX: number; 
    tileY: number; 
    direction: CarDirection; 
    progress: number;
    carriages: { tileX: number; tileY: number }[];
  }[],
  tileX: number,
  tileY: number
): CrossingState {
  const { isApproaching, isOccupied, distance } = isTrainApproachingTile(trains, tileX, tileY);
  
  if (isOccupied) return 'closed';
  if (isApproaching && distance <= 1) return 'closed';
  if (isApproaching) return 'warning';
  return 'open';
}

/**
 * Check if a vehicle should stop at a railroad crossing
 * @param trains - Array of all active trains
 * @param crossingX - Crossing tile X coordinate
 * @param crossingY - Crossing tile Y coordinate
 * @returns true if vehicles should stop
 */
export function shouldStopAtCrossing(
  trains: { 
    tileX: number; 
    tileY: number; 
    direction: CarDirection; 
    progress: number;
    carriages: { tileX: number; tileY: number }[];
  }[],
  crossingX: number,
  crossingY: number
): boolean {
  const state = getCrossingStateForTile(trains, crossingX, crossingY);
  return state === 'closed' || state === 'warning';
}

/**
 * Find path on rail network between two points
 */
export function findPathOnRails(
  grid: Tile[][],
  gridSize: number,
  startX: number,
  startY: number,
  endX: number,
  endY: number
): { x: number; y: number }[] | null {
  // BFS pathfinding on rail network
  const queue: { x: number; y: number; path: { x: number; y: number }[] }[] = [
    { x: startX, y: startY, path: [{ x: startX, y: startY }] }
  ];
  const visited = new Set<string>();
  visited.add(`${startX},${startY}`);

  const directions = [
    { dx: -1, dy: 0 },  // north
    { dx: 0, dy: -1 },  // east
    { dx: 1, dy: 0 },   // south
    { dx: 0, dy: 1 },   // west
  ];

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current.x === endX && current.y === endY) {
      return current.path;
    }

    for (const { dx, dy } of directions) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      const key = `${nx},${ny}`;

      if (nx < 0 || ny < 0 || nx >= gridSize || ny >= gridSize) continue;
      if (visited.has(key)) continue;
      if (!isRailTile(grid, gridSize, nx, ny) && !isRailStationTile(grid, gridSize, nx, ny)) continue;

      visited.add(key);
      queue.push({
        x: nx,
        y: ny,
        path: [...current.path, { x: nx, y: ny }],
      });
    }
  }

  return null;
}
