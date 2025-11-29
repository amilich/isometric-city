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
  TIE: '#3a2718',               // Wooden rail ties (sleepers) - darker for contrast
  TIE_HIGHLIGHT: '#5d4a3a',     // Lighter tie surface
  RAIL: '#303030',              // Steel rail - darker for visibility
  RAIL_HIGHLIGHT: '#505050',    // Rail highlight
  RAIL_SHADOW: '#1a1a1a',       // Rail shadow
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
export const TIES_PER_TILE = 5;

/** Separation between the two parallel tracks as ratio of tile width */
export const TRACK_SEPARATION_RATIO = 0.22;

/** Train car dimensions - smaller for double track */
export const TRAIN_CAR = {
  LOCOMOTIVE_LENGTH: 12,
  CAR_LENGTH: 10,
  CAR_WIDTH: 4,
  CAR_SPACING: 2, // Gap between cars
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
 * Check if a tile is a rail track (pure rail tile OR road with rail overlay)
 */
export function isRailTile(grid: Tile[][], gridSize: number, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) return false;
  const tile = grid[y][x];
  return tile.building.type === 'rail' || (tile.building.type === 'road' && tile.hasRailOverlay === true);
}

/**
 * Check if a tile is a rail station
 */
export function isRailStationTile(grid: Tile[][], gridSize: number, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) return false;
  return grid[y][x].building.type === 'rail_station';
}

/**
 * Check if a tile has rail (either pure rail tile OR road with rail overlay)
 */
function hasRailAtPosition(grid: Tile[][], gridSize: number, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) return false;
  const tile = grid[y][x];
  return tile.building.type === 'rail' || 
         tile.building.type === 'rail_station' || 
         (tile.building.type === 'road' && tile.hasRailOverlay === true);
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
  const drawCenterBallast = () => {
    const size = (ballastW + trackSep) * 0.8;
    ctx.beginPath();
    ctx.moveTo(cx, cy - size * 0.5);
    ctx.lineTo(cx + size, cy);
    ctx.lineTo(cx, cy + size * 0.5);
    ctx.lineTo(cx - size, cy);
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
      // T-junction with no north: has east, south, west
      // Main line (E-W) stays straight
      drawDoubleStraightBallast(eastEdge, westEdge, ISO_NS);
      // Curved connections from south stem to both ends of the main line
      drawDoubleCurvedBallast(southEdge, eastEdge, center, ISO_EW, NEG_ISO_NS, { x: -1, y: 0 });
      drawDoubleCurvedBallast(southEdge, westEdge, center, NEG_ISO_EW, NEG_ISO_NS, { x: 0, y: -1 });
      drawCenterBallast();
      break;
    case 'junction_t_e':
      // T-junction with no east: has north, south, west
      // Main line (N-S) stays straight
      drawDoubleStraightBallast(northEdge, southEdge, ISO_EW);
      // Curved connections from west stem to both ends of the main line
      drawDoubleCurvedBallast(westEdge, northEdge, center, NEG_ISO_EW, ISO_NS, { x: 1, y: 0 });
      drawDoubleCurvedBallast(westEdge, southEdge, center, NEG_ISO_EW, NEG_ISO_NS, { x: 0, y: -1 });
      drawCenterBallast();
      break;
    case 'junction_t_s':
      // T-junction with no south: has north, east, west
      // Main line (E-W) stays straight
      drawDoubleStraightBallast(eastEdge, westEdge, ISO_NS);
      // Curved connections from north stem to both ends of the main line
      drawDoubleCurvedBallast(northEdge, eastEdge, center, ISO_EW, ISO_NS, { x: 0, y: 1 });
      drawDoubleCurvedBallast(northEdge, westEdge, center, NEG_ISO_EW, ISO_NS, { x: 1, y: 0 });
      drawCenterBallast();
      break;
    case 'junction_t_w':
      // T-junction with no west: has north, east, south
      // Main line (N-S) stays straight
      drawDoubleStraightBallast(northEdge, southEdge, ISO_EW);
      // Curved connections from east stem to both ends of the main line
      drawDoubleCurvedBallast(eastEdge, northEdge, center, ISO_EW, ISO_NS, { x: 0, y: 1 });
      drawDoubleCurvedBallast(eastEdge, southEdge, center, ISO_EW, NEG_ISO_NS, { x: -1, y: 0 });
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

/** Screen-space perpendicular (90° clockwise rotation) */
const getScreenPerp = (dx: number, dy: number) => ({ x: dy, y: -dx });

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
  const tieWidth = w * 0.025;
  const tieLength = w * BALLAST_WIDTH_RATIO * 0.85;
  const trackSep = w * TRACK_SEPARATION_RATIO;
  const halfSep = trackSep / 2;

  const northEdge = { x: x + w * 0.25, y: y + h * 0.25 };
  const eastEdge = { x: x + w * 0.75, y: y + h * 0.25 };
  const southEdge = { x: x + w * 0.75, y: y + h * 0.75 };
  const westEdge = { x: x + w * 0.25, y: y + h * 0.75 };
  const center = { x: cx, y: cy };

  ctx.fillStyle = RAIL_COLORS.TIE;

  const drawTie = (tieX: number, tieY: number, tieDir: { x: number; y: number }) => {
    const halfLen = tieLength / 2;
    const halfWidth = tieWidth / 2;
    const perpDir = getScreenPerp(tieDir.x, tieDir.y);
    
    ctx.beginPath();
    ctx.moveTo(tieX + tieDir.x * halfLen + perpDir.x * halfWidth, tieY + tieDir.y * halfLen + perpDir.y * halfWidth);
    ctx.lineTo(tieX + tieDir.x * halfLen - perpDir.x * halfWidth, tieY + tieDir.y * halfLen - perpDir.y * halfWidth);
    ctx.lineTo(tieX - tieDir.x * halfLen - perpDir.x * halfWidth, tieY - tieDir.y * halfLen - perpDir.y * halfWidth);
    ctx.lineTo(tieX - tieDir.x * halfLen + perpDir.x * halfWidth, tieY - tieDir.y * halfLen + perpDir.y * halfWidth);
    ctx.closePath();
    ctx.fill();
  };

  // Draw ties for a single track along a straight segment
  const drawSingleTrackTies = (
    from: { x: number; y: number },
    to: { x: number; y: number },
    tieDir: { x: number; y: number },
    numTies: number
  ) => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    for (let i = 0; i < numTies; i++) {
      const t = (i + 0.5) / numTies;
      drawTie(from.x + dx * t, from.y + dy * t, tieDir);
    }
  };

  // Draw ties for double track along a straight segment
  const drawDoubleTies = (
    from: { x: number; y: number },
    to: { x: number; y: number },
    tieDir: { x: number; y: number },
    perp: { x: number; y: number },
    numTies: number
  ) => {
    // Track 0
    const from0 = offsetPoint(from, perp, halfSep);
    const to0 = offsetPoint(to, perp, halfSep);
    drawSingleTrackTies(from0, to0, tieDir, numTies);
    // Track 1
    const from1 = offsetPoint(from, perp, -halfSep);
    const to1 = offsetPoint(to, perp, -halfSep);
    drawSingleTrackTies(from1, to1, tieDir, numTies);
  };

  // Draw ties for a single track along a curve
  const drawSingleCurveTies = (
    from: { x: number; y: number },
    to: { x: number; y: number },
    control: { x: number; y: number },
    fromTieDir: { x: number; y: number },
    toTieDir: { x: number; y: number },
    numTies: number
  ) => {
    for (let i = 0; i < numTies; i++) {
      const t = (i + 0.5) / numTies;
      const u = 1 - t;
      const tieX = u * u * from.x + 2 * u * t * control.x + t * t * to.x;
      const tieY = u * u * from.y + 2 * u * t * control.y + t * t * to.y;
      const interpDir = { x: fromTieDir.x * u + toTieDir.x * t, y: fromTieDir.y * u + toTieDir.y * t };
      const interpLen = Math.hypot(interpDir.x, interpDir.y);
      drawTie(tieX, tieY, { x: interpDir.x / interpLen, y: interpDir.y / interpLen });
    }
  };

  // Draw ties for double track along a curve
  const drawDoubleCurveTies = (
    from: { x: number; y: number },
    to: { x: number; y: number },
    control: { x: number; y: number },
    fromTieDir: { x: number; y: number },
    toTieDir: { x: number; y: number },
    fromPerp: { x: number; y: number },
    toPerp: { x: number; y: number },
    curvePerp: { x: number; y: number },
    numTies: number
  ) => {
    // Track 0
    const from0 = offsetPoint(from, fromPerp, halfSep);
    const to0 = offsetPoint(to, toPerp, halfSep);
    const ctrl0 = offsetPoint(control, curvePerp, halfSep);
    drawSingleCurveTies(from0, to0, ctrl0, fromTieDir, toTieDir, numTies);
    // Track 1
    const from1 = offsetPoint(from, fromPerp, -halfSep);
    const to1 = offsetPoint(to, toPerp, -halfSep);
    const ctrl1 = offsetPoint(control, curvePerp, -halfSep);
    drawSingleCurveTies(from1, to1, ctrl1, fromTieDir, toTieDir, numTies);
  };

  const tiesHalf = Math.ceil(TIES_PER_TILE / 2);

  switch (trackType) {
    case 'straight_ns':
      drawDoubleTies(northEdge, southEdge, ISO_EW, ISO_EW, TIES_PER_TILE);
      break;
    case 'straight_ew':
      drawDoubleTies(eastEdge, westEdge, ISO_NS, ISO_NS, TIES_PER_TILE);
      break;
    case 'curve_ne':
      drawDoubleCurveTies(northEdge, eastEdge, center, ISO_EW, ISO_NS, ISO_EW, ISO_NS, { x: 0, y: 1 }, TIES_PER_TILE);
      break;
    case 'curve_nw':
      drawDoubleCurveTies(northEdge, westEdge, center, NEG_ISO_EW, ISO_NS, NEG_ISO_EW, ISO_NS, { x: 1, y: 0 }, TIES_PER_TILE);
      break;
    case 'curve_se':
      drawDoubleCurveTies(southEdge, eastEdge, center, ISO_EW, NEG_ISO_NS, ISO_EW, NEG_ISO_NS, { x: -1, y: 0 }, TIES_PER_TILE);
      break;
    case 'curve_sw':
      drawDoubleCurveTies(southEdge, westEdge, center, NEG_ISO_EW, NEG_ISO_NS, NEG_ISO_EW, NEG_ISO_NS, { x: 0, y: -1 }, TIES_PER_TILE);
      break;
    case 'junction_t_n':
      // T-junction with no north: has east, south, west
      // Main line (E-W) straight ties
      drawDoubleTies(eastEdge, westEdge, ISO_NS, ISO_NS, TIES_PER_TILE);
      // Curved ties from south stem to both ends of the main line
      drawDoubleCurveTies(southEdge, eastEdge, center, ISO_EW, NEG_ISO_NS, ISO_EW, NEG_ISO_NS, { x: -1, y: 0 }, TIES_PER_TILE);
      drawDoubleCurveTies(southEdge, westEdge, center, NEG_ISO_EW, NEG_ISO_NS, NEG_ISO_EW, NEG_ISO_NS, { x: 0, y: -1 }, TIES_PER_TILE);
      break;
    case 'junction_t_e':
      // T-junction with no east: has north, south, west
      // Main line (N-S) straight ties
      drawDoubleTies(northEdge, southEdge, ISO_EW, ISO_EW, TIES_PER_TILE);
      // Curved ties from west stem to both ends of the main line
      drawDoubleCurveTies(westEdge, northEdge, center, NEG_ISO_EW, ISO_NS, NEG_ISO_EW, ISO_NS, { x: 1, y: 0 }, TIES_PER_TILE);
      drawDoubleCurveTies(westEdge, southEdge, center, NEG_ISO_EW, NEG_ISO_NS, NEG_ISO_EW, NEG_ISO_NS, { x: 0, y: -1 }, TIES_PER_TILE);
      break;
    case 'junction_t_s':
      // T-junction with no south: has north, east, west
      // Main line (E-W) straight ties
      drawDoubleTies(eastEdge, westEdge, ISO_NS, ISO_NS, TIES_PER_TILE);
      // Curved ties from north stem to both ends of the main line
      drawDoubleCurveTies(northEdge, eastEdge, center, ISO_EW, ISO_NS, ISO_EW, ISO_NS, { x: 0, y: 1 }, TIES_PER_TILE);
      drawDoubleCurveTies(northEdge, westEdge, center, NEG_ISO_EW, ISO_NS, NEG_ISO_EW, ISO_NS, { x: 1, y: 0 }, TIES_PER_TILE);
      break;
    case 'junction_t_w':
      // T-junction with no west: has north, east, south
      // Main line (N-S) straight ties
      drawDoubleTies(northEdge, southEdge, ISO_EW, ISO_EW, TIES_PER_TILE);
      // Curved ties from east stem to both ends of the main line
      drawDoubleCurveTies(eastEdge, northEdge, center, ISO_EW, ISO_NS, ISO_EW, ISO_NS, { x: 0, y: 1 }, TIES_PER_TILE);
      drawDoubleCurveTies(eastEdge, southEdge, center, ISO_EW, NEG_ISO_NS, ISO_EW, NEG_ISO_NS, { x: -1, y: 0 }, TIES_PER_TILE);
      break;
    case 'junction_cross':
      drawDoubleTies(northEdge, southEdge, ISO_EW, ISO_EW, TIES_PER_TILE);
      drawDoubleTies(eastEdge, westEdge, ISO_NS, ISO_NS, TIES_PER_TILE);
      break;
    case 'terminus_n':
      drawDoubleTies(center, southEdge, ISO_EW, ISO_EW, tiesHalf);
      break;
    case 'terminus_e':
      drawDoubleTies(center, westEdge, ISO_NS, ISO_NS, tiesHalf);
      break;
    case 'terminus_s':
      drawDoubleTies(center, northEdge, ISO_EW, ISO_EW, tiesHalf);
      break;
    case 'terminus_w':
      drawDoubleTies(center, eastEdge, ISO_NS, ISO_NS, tiesHalf);
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
      drawDoubleTies(singleFrom, singleTo, ewDir, ewDir, 3);
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
  const railWidth = zoom >= 0.7 ? 1.5 : 1.2;
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
      // T-junction with no north: has east, south, west
      // Main line (E-W) straight rails
      drawDoubleStraightRails(eastEdge, westEdge, ISO_NS);
      // Curved rails from south stem to both ends of the main line
      drawDoubleCurvedRails(southEdge, eastEdge, center, ISO_EW, NEG_ISO_NS, { x: -1, y: 0 });
      drawDoubleCurvedRails(southEdge, westEdge, center, NEG_ISO_EW, NEG_ISO_NS, { x: 0, y: -1 });
      break;
    case 'junction_t_e':
      // T-junction with no east: has north, south, west
      // Main line (N-S) straight rails
      drawDoubleStraightRails(northEdge, southEdge, ISO_EW);
      // Curved rails from west stem to both ends of the main line
      drawDoubleCurvedRails(westEdge, northEdge, center, NEG_ISO_EW, ISO_NS, { x: 1, y: 0 });
      drawDoubleCurvedRails(westEdge, southEdge, center, NEG_ISO_EW, NEG_ISO_NS, { x: 0, y: -1 });
      break;
    case 'junction_t_s':
      // T-junction with no south: has north, east, west
      // Main line (E-W) straight rails
      drawDoubleStraightRails(eastEdge, westEdge, ISO_NS);
      // Curved rails from north stem to both ends of the main line
      drawDoubleCurvedRails(northEdge, eastEdge, center, ISO_EW, ISO_NS, { x: 0, y: 1 });
      drawDoubleCurvedRails(northEdge, westEdge, center, NEG_ISO_EW, ISO_NS, { x: 1, y: 0 });
      break;
    case 'junction_t_w':
      // T-junction with no west: has north, east, south
      // Main line (N-S) straight rails
      drawDoubleStraightRails(northEdge, southEdge, ISO_EW);
      // Curved rails from east stem to both ends of the main line
      drawDoubleCurvedRails(eastEdge, northEdge, center, ISO_EW, ISO_NS, { x: 0, y: 1 });
      drawDoubleCurvedRails(eastEdge, southEdge, center, ISO_EW, NEG_ISO_NS, { x: -1, y: 0 });
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
  
  // White stripe
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-size - offset, -size / 4, size, size / 2);

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
    // Consider a tile as having rail if it's a rail tile, a rail station, or a road with rail overlay
    return tile.building.type === 'rail' || 
           tile.building.type === 'rail_station' || 
           (tile.building.type === 'road' && tile.hasRailOverlay === true);
  };

  return {
    north: hasRailAt(x - 1, y),
    east: hasRailAt(x, y - 1),
    south: hasRailAt(x + 1, y),
    west: hasRailAt(x, y + 1),
  };
}

/**
 * Draw rail tracks only (ties and rails, no ballast) for overlay on roads
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

  // Draw only ties and rails (no ballast) - the road base is already drawn
  drawTies(ctx, x, y, trackType, zoom);
  drawRails(ctx, x, y, trackType, zoom);
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
 * Count rail tiles in the grid (includes pure rail tiles AND road tiles with rail overlay)
 */
export function countRailTiles(
  grid: Tile[][],
  gridSize: number
): number {
  let count = 0;
  
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const tile = grid[y][x];
      if (tile.building.type === 'rail' || (tile.building.type === 'road' && tile.hasRailOverlay === true)) {
        count++;
      }
    }
  }
  
  return count;
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
