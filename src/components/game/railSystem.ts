/**
 * Rail System - Track rendering and configuration for trains
 * Handles rail track drawing with proper isometric alignment, curves, and spurs
 */

import { Tile } from '@/types/game';
import { TILE_WIDTH, TILE_HEIGHT } from './types';

// ============================================================================
// Types
// ============================================================================

/** Rail track configuration based on adjacent rail connections */
export type RailConfiguration = 
  | 'none'           // No connections - single tile terminus
  | 'ns'             // North-South straight
  | 'ew'             // East-West straight
  | 'ne'             // North-East curve
  | 'nw'             // North-West curve
  | 'se'             // South-East curve
  | 'sw'             // South-West curve
  | 'nse'            // T-junction (north, south, east)
  | 'nsw'            // T-junction (north, south, west)
  | 'new'            // T-junction (north, east, west)
  | 'sew'            // T-junction (south, east, west)
  | 'nsew'           // Four-way crossing
  | 'n'              // Dead end north
  | 'e'              // Dead end east
  | 's'              // Dead end south
  | 'w';             // Dead end west

/** Adjacent rail information */
export interface AdjacentRails {
  north: boolean;
  east: boolean;
  south: boolean;
  west: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/** Rail track visual constants */
export const RAIL_CONFIG = {
  /** Distance between the two parallel tracks (as fraction of tile width) */
  TRACK_SPACING: 0.22,
  /** Width of each rail track line */
  RAIL_WIDTH: 2.5,
  /** Width of rail ties (sleepers) */
  TIE_WIDTH: 3,
  /** Spacing between ties (as fraction of tile dimension) */
  TIE_SPACING: 0.10,
  /** Length of ties (perpendicular to tracks) */
  TIE_LENGTH_RATIO: 0.40,
};

/** Rail track colors */
export const RAIL_COLORS = {
  /** Ballast/gravel base */
  BALLAST: '#6b6b6b',
  BALLAST_DARK: '#555555',
  /** Rail track metal - bright silver for visibility */
  RAIL: '#c0c0c0',
  RAIL_HIGHLIGHT: '#e0e0e0',
  /** Wooden ties/sleepers - darker brown for contrast */
  TIE: '#4a3728',
  TIE_DARK: '#3d2d20',
};

// ============================================================================
// Rail Analysis Functions
// ============================================================================

/**
 * Check if a tile is a rail track
 */
export function isRail(grid: Tile[][], gridSize: number, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) return false;
  return grid[y][x].building.type === 'rail';
}

/**
 * Check if a tile is a rail station
 */
export function isRailStation(grid: Tile[][], gridSize: number, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) return false;
  return grid[y][x].building.type === 'rail_station';
}

/**
 * Check if a tile can connect to rail (rail or rail_station)
 */
export function canConnectToRail(grid: Tile[][], gridSize: number, x: number, y: number): boolean {
  return isRail(grid, gridSize, x, y) || isRailStation(grid, gridSize, x, y);
}

/**
 * Get adjacent rail connections for a tile
 */
export function getAdjacentRails(
  grid: Tile[][],
  gridSize: number,
  x: number,
  y: number
): AdjacentRails {
  return {
    north: canConnectToRail(grid, gridSize, x - 1, y),
    east: canConnectToRail(grid, gridSize, x, y - 1),
    south: canConnectToRail(grid, gridSize, x + 1, y),
    west: canConnectToRail(grid, gridSize, x, y + 1),
  };
}

/**
 * Determine rail configuration based on adjacent connections
 */
export function getRailConfiguration(adj: AdjacentRails): RailConfiguration {
  const { north, east, south, west } = adj;
  const count = [north, east, south, west].filter(Boolean).length;

  if (count === 0) return 'none';
  if (count === 4) return 'nsew';
  
  if (count === 3) {
    if (!north) return 'sew';
    if (!east) return 'nsw';
    if (!south) return 'new';
    if (!west) return 'nse';
  }
  
  if (count === 2) {
    if (north && south) return 'ns';
    if (east && west) return 'ew';
    if (north && east) return 'ne';
    if (north && west) return 'nw';
    if (south && east) return 'se';
    if (south && west) return 'sw';
  }
  
  if (count === 1) {
    if (north) return 'n';
    if (east) return 'e';
    if (south) return 's';
    if (west) return 'w';
  }
  
  return 'none';
}

// ============================================================================
// Rail Drawing Functions
// ============================================================================

/**
 * Calculate isometric edge midpoints for rail connections
 * These are the exact points where rails connect to adjacent tiles
 */
function getEdgeMidpoints(x: number, y: number) {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = x + w / 2;
  const cy = y + h / 2;
  
  // Diamond corners
  const topCorner = { x: cx, y: y };
  const rightCorner = { x: x + w, y: cy };
  const bottomCorner = { x: cx, y: y + h };
  const leftCorner = { x: x, y: cy };
  
  // Edge midpoints (where tracks enter/exit the tile)
  // These are midpoints along each edge of the isometric diamond
  return {
    north: {
      x: (leftCorner.x + topCorner.x) / 2,
      y: (leftCorner.y + topCorner.y) / 2
    },
    east: {
      x: (topCorner.x + rightCorner.x) / 2,
      y: (topCorner.y + rightCorner.y) / 2
    },
    south: {
      x: (rightCorner.x + bottomCorner.x) / 2,
      y: (rightCorner.y + bottomCorner.y) / 2
    },
    west: {
      x: (bottomCorner.x + leftCorner.x) / 2,
      y: (bottomCorner.y + leftCorner.y) / 2
    },
    center: { x: cx, y: cy }
  };
}

/**
 * Calculate perpendicular offset for parallel tracks
 * Given a direction vector, returns the perpendicular offset for track spacing
 */
function getPerpendicularOffset(
  fromX: number, fromY: number,
  toX: number, toY: number,
  spacing: number
): { dx: number; dy: number } {
  const dirX = toX - fromX;
  const dirY = toY - fromY;
  const len = Math.hypot(dirX, dirY);
  if (len === 0) return { dx: 0, dy: 0 };
  
  // Perpendicular is (-dy, dx) normalized and scaled
  const perpX = -dirY / len * spacing;
  const perpY = dirX / len * spacing;
  
  return { dx: perpX, dy: perpY };
}

/**
 * Draw a single rail track line
 */
function drawRailLine(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  x2: number, y2: number
): void {
  ctx.strokeStyle = RAIL_COLORS.RAIL;
  ctx.lineWidth = RAIL_CONFIG.RAIL_WIDTH;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  
  // Add highlight
  ctx.strokeStyle = RAIL_COLORS.RAIL_HIGHLIGHT;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

/**
 * Draw ties (sleepers) between two parallel tracks
 */
function drawTies(
  ctx: CanvasRenderingContext2D,
  track1Start: { x: number; y: number },
  track1End: { x: number; y: number },
  track2Start: { x: number; y: number },
  track2End: { x: number; y: number },
  numTies: number
): void {
  ctx.strokeStyle = RAIL_COLORS.TIE;
  ctx.lineWidth = RAIL_CONFIG.TIE_WIDTH;
  ctx.lineCap = 'butt';
  
  for (let i = 0; i <= numTies; i++) {
    const t = i / numTies;
    // Interpolate along both tracks
    const p1x = track1Start.x + (track1End.x - track1Start.x) * t;
    const p1y = track1Start.y + (track1End.y - track1Start.y) * t;
    const p2x = track2Start.x + (track2End.x - track2Start.x) * t;
    const p2y = track2Start.y + (track2End.y - track2Start.y) * t;
    
    ctx.beginPath();
    ctx.moveTo(p1x, p1y);
    ctx.lineTo(p2x, p2y);
    ctx.stroke();
  }
}

/**
 * Draw a straight track segment with two parallel rails
 * from one edge midpoint to another
 */
function drawStraightTrack(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
  spacing: number
): void {
  const perp = getPerpendicularOffset(from.x, from.y, to.x, to.y, spacing / 2);
  
  // Track 1 (offset in positive perpendicular direction)
  const track1Start = { x: from.x + perp.dx, y: from.y + perp.dy };
  const track1End = { x: to.x + perp.dx, y: to.y + perp.dy };
  
  // Track 2 (offset in negative perpendicular direction)
  const track2Start = { x: from.x - perp.dx, y: from.y - perp.dy };
  const track2End = { x: to.x - perp.dx, y: to.y - perp.dy };
  
  // Calculate number of ties based on track length
  const trackLen = Math.hypot(to.x - from.x, to.y - from.y);
  const numTies = Math.max(2, Math.floor(trackLen / (TILE_WIDTH * RAIL_CONFIG.TIE_SPACING)));
  
  // Draw ties first (behind rails)
  drawTies(ctx, track1Start, track1End, track2Start, track2End, numTies);
  
  // Draw both rail lines
  drawRailLine(ctx, track1Start.x, track1Start.y, track1End.x, track1End.y);
  drawRailLine(ctx, track2Start.x, track2Start.y, track2End.x, track2End.y);
}

/**
 * Draw a curved track segment connecting two perpendicular directions
 * For simplicity, draws the curve as two straight segments through center
 */
function drawCurvedTrack(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
  center: { x: number; y: number },
  spacing: number,
  _clockwise: boolean
): void {
  // For curves, draw two straight track segments: from->center and center->to
  // This creates a simple angled curve that works well in isometric view
  drawStraightTrack(ctx, from, center, spacing);
  drawStraightTrack(ctx, center, to, spacing);
}

/**
 * Draw ballast/gravel base for rail tracks
 */
function drawBallast(
  ctx: CanvasRenderingContext2D,
  _x: number,
  _y: number,
  config: RailConfiguration,
  edges: ReturnType<typeof getEdgeMidpoints>
): void {
  const ballastWidth = TILE_WIDTH * (RAIL_CONFIG.TRACK_SPACING + 0.08);
  
  ctx.fillStyle = RAIL_COLORS.BALLAST;
  ctx.strokeStyle = RAIL_COLORS.BALLAST_DARK;
  ctx.lineWidth = 1;
  
  // Draw ballast strips based on configuration
  const drawBallastStrip = (
    from: { x: number; y: number },
    to: { x: number; y: number }
  ) => {
    const perp = getPerpendicularOffset(from.x, from.y, to.x, to.y, ballastWidth / 2);
    
    ctx.beginPath();
    ctx.moveTo(from.x + perp.dx, from.y + perp.dy);
    ctx.lineTo(to.x + perp.dx, to.y + perp.dy);
    ctx.lineTo(to.x - perp.dx, to.y - perp.dy);
    ctx.lineTo(from.x - perp.dx, from.y - perp.dy);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };
  
  // Draw ballast based on track configuration
  const { north, east, south, west, center } = edges;
  
  // Helper to check if config has a specific direction
  const hasNorth = config === 'n' || config === 'ns' || config === 'ne' || config === 'nw' ||
                   config === 'nse' || config === 'nsw' || config === 'new' || config === 'nsew';
  const hasSouth = config === 's' || config === 'ns' || config === 'se' || config === 'sw' ||
                   config === 'nse' || config === 'nsw' || config === 'sew' || config === 'nsew';
  const hasEast = config === 'e' || config === 'ew' || config === 'ne' || config === 'se' ||
                  config === 'nse' || config === 'new' || config === 'sew' || config === 'nsew';
  const hasWest = config === 'w' || config === 'ew' || config === 'nw' || config === 'sw' ||
                  config === 'nsw' || config === 'new' || config === 'sew' || config === 'nsew';
  
  // For 'none' config, draw a small central ballast pad
  if (config === 'none') {
    ctx.beginPath();
    ctx.arc(center.x, center.y, ballastWidth * 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    return;
  }
  
  // For each direction that has a connection
  if (hasNorth) drawBallastStrip(north, center);
  if (hasSouth) drawBallastStrip(south, center);
  if (hasEast) drawBallastStrip(east, center);
  if (hasWest) drawBallastStrip(west, center);
  
  // Draw center circle for intersections (T-junctions and crossings)
  if (config === 'nsew' || config === 'nse' || config === 'nsw' || 
      config === 'new' || config === 'sew') {
    ctx.beginPath();
    ctx.arc(center.x, center.y, ballastWidth * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

// ============================================================================
// Main Rail Drawing Function
// ============================================================================

/**
 * Draw rail tracks on a tile
 */
export function drawRailTracks(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  adj: AdjacentRails,
  _zoom: number
): void {
  ctx.save();
  
  const config = getRailConfiguration(adj);
  const edges = getEdgeMidpoints(screenX, screenY);
  const { north, east, south, west, center } = edges;
  const spacing = TILE_WIDTH * RAIL_CONFIG.TRACK_SPACING;
  
  // Draw ballast base first
  drawBallast(ctx, screenX, screenY, config, edges);
  
  // Draw tracks based on configuration
  switch (config) {
    case 'none':
      // No connections - draw a buffer stop with visible track stub
      // Draw a short track segment in NS direction as default
      drawStraightTrack(ctx, 
        { x: center.x - (north.x - center.x) * 0.3, y: center.y - (north.y - center.y) * 0.3 },
        { x: center.x + (south.x - center.x) * 0.3, y: center.y + (south.y - center.y) * 0.3 },
        spacing
      );
      // Draw buffer stop marker
      ctx.fillStyle = RAIL_COLORS.TIE_DARK;
      ctx.beginPath();
      ctx.arc(center.x, center.y, spacing * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff6600'; // Orange warning color
      ctx.beginPath();
      ctx.arc(center.x, center.y, spacing * 0.3, 0, Math.PI * 2);
      ctx.fill();
      break;
      
    case 'ns':
      // North-South straight
      drawStraightTrack(ctx, north, south, spacing);
      break;
      
    case 'ew':
      // East-West straight
      drawStraightTrack(ctx, east, west, spacing);
      break;
      
    case 'ne':
      // North-East curve
      drawCurvedTrack(ctx, north, east, center, spacing, true);
      break;
      
    case 'nw':
      // North-West curve
      drawCurvedTrack(ctx, north, west, center, spacing, false);
      break;
      
    case 'se':
      // South-East curve
      drawCurvedTrack(ctx, south, east, center, spacing, false);
      break;
      
    case 'sw':
      // South-West curve
      drawCurvedTrack(ctx, south, west, center, spacing, true);
      break;
      
    case 'n':
      // Dead end north - track from center to north edge
      drawStraightTrack(ctx, center, north, spacing);
      break;
      
    case 'e':
      // Dead end east
      drawStraightTrack(ctx, center, east, spacing);
      break;
      
    case 's':
      // Dead end south
      drawStraightTrack(ctx, center, south, spacing);
      break;
      
    case 'w':
      // Dead end west
      drawStraightTrack(ctx, center, west, spacing);
      break;
      
    case 'nse':
      // T-junction: N, S, E
      drawStraightTrack(ctx, north, south, spacing);
      drawStraightTrack(ctx, center, east, spacing);
      break;
      
    case 'nsw':
      // T-junction: N, S, W
      drawStraightTrack(ctx, north, south, spacing);
      drawStraightTrack(ctx, center, west, spacing);
      break;
      
    case 'new':
      // T-junction: N, E, W
      drawStraightTrack(ctx, east, west, spacing);
      drawStraightTrack(ctx, center, north, spacing);
      break;
      
    case 'sew':
      // T-junction: S, E, W
      drawStraightTrack(ctx, east, west, spacing);
      drawStraightTrack(ctx, center, south, spacing);
      break;
      
    case 'nsew':
      // Four-way crossing
      drawStraightTrack(ctx, north, south, spacing);
      drawStraightTrack(ctx, east, west, spacing);
      break;
      
    default:
      // Fallback: draw a visible marker for any unhandled configuration
      ctx.fillStyle = '#ff0000';
      ctx.beginPath();
      ctx.arc(center.x, center.y, spacing, 0, Math.PI * 2);
      ctx.fill();
      break;
  }
  
  ctx.restore();
}

/**
 * Draw rail station sprite (using subway station sprite as placeholder)
 * The station should connect to adjacent rail tracks
 */
export function drawRailStation(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  _zoom: number
): void {
  // For now, we draw a simple platform representation
  // The actual sprite will be drawn by the main render system using subway_station sprite
  // This function adds the track connections to/from the station
  
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = screenX + w / 2;
  const cy = screenY + h / 2;
  
  // Draw platform base
  ctx.fillStyle = '#6b7280';
  const platformWidth = w * 0.7;
  const platformHeight = h * 0.5;
  
  ctx.beginPath();
  ctx.moveTo(cx, cy - platformHeight / 2);
  ctx.lineTo(cx + platformWidth / 2, cy);
  ctx.lineTo(cx, cy + platformHeight / 2);
  ctx.lineTo(cx - platformWidth / 2, cy);
  ctx.closePath();
  ctx.fill();
  
  ctx.strokeStyle = '#4b5563';
  ctx.lineWidth = 1;
  ctx.stroke();
}
