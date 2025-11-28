/**
 * Rail System - Rail tracks and train management
 * Handles rail track rendering, adjacency detection, and train movement
 */

import { Tile } from '@/types/game';
import { TILE_WIDTH, TILE_HEIGHT, CarDirection, Train } from './types';
import { TRAIN_COLORS, TRAIN_SPEED_MIN, TRAIN_SPEED_MAX, DIRECTION_META, OPPOSITE_DIRECTION } from './constants';

// ============================================================================
// Types
// ============================================================================

/** Rail track configuration based on adjacent rails */
export interface RailConfig {
  // Which directions connect to other rails
  north: boolean;
  east: boolean;
  south: boolean;
  west: boolean;
  // Configuration type for rendering
  type: 'straight_ns' | 'straight_ew' | 'curve_ne' | 'curve_nw' | 'curve_se' | 'curve_sw' | 'junction_t' | 'junction_cross' | 'end' | 'single';
  // Total connection count
  connectionCount: number;
}

// ============================================================================
// Constants
// ============================================================================

/** Rail rendering constants */
export const RAIL_CONFIG = {
  TRACK_SPACING: 0.12,    // Distance between the two rail tracks as fraction of tile width
  RAIL_WIDTH: 0.015,      // Width of each rail
  TIE_WIDTH: 0.04,        // Width of railroad ties
  TIE_SPACING: 0.12,      // Spacing between ties
  BALLAST_WIDTH: 0.18,    // Width of gravel/ballast area
};

/** Colors for rail rendering */
export const RAIL_COLORS = {
  RAIL: '#5c5c5c',          // Steel rail color
  RAIL_HIGHLIGHT: '#7a7a7a', // Rail highlight
  TIE: '#5d4037',           // Wooden tie color (brown)
  TIE_DARK: '#3e2723',      // Darker tie edge
  BALLAST: '#78909c',       // Gravel/crushed stone
  BALLAST_DARK: '#546e7a',  // Darker ballast
};

// ============================================================================
// Rail Analysis Functions
// ============================================================================

/**
 * Check if a tile is a rail track
 */
export function isRailTile(grid: Tile[][], gridSize: number, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) return false;
  return grid[y][x].building.type === 'rail';
}

/**
 * Check if a tile is a rail station
 */
export function isRailStationTile(grid: Tile[][], gridSize: number, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) return false;
  return grid[y][x].building.type === 'rail_station';
}

/**
 * Check if a tile can be part of rail network (rail or rail_station)
 */
export function isRailNetworkTile(grid: Tile[][], gridSize: number, x: number, y: number): boolean {
  return isRailTile(grid, gridSize, x, y) || isRailStationTile(grid, gridSize, x, y);
}

/**
 * Get adjacent rail info for a tile
 */
export function getAdjacentRails(
  grid: Tile[][],
  gridSize: number,
  x: number,
  y: number
): { north: boolean; east: boolean; south: boolean; west: boolean } {
  return {
    north: isRailNetworkTile(grid, gridSize, x - 1, y),
    east: isRailNetworkTile(grid, gridSize, x, y - 1),
    south: isRailNetworkTile(grid, gridSize, x + 1, y),
    west: isRailNetworkTile(grid, gridSize, x, y + 1),
  };
}

/**
 * Analyze rail configuration for rendering
 */
export function analyzeRailConfig(
  grid: Tile[][],
  gridSize: number,
  x: number,
  y: number
): RailConfig {
  const adj = getAdjacentRails(grid, gridSize, x, y);
  const connectionCount = [adj.north, adj.east, adj.south, adj.west].filter(Boolean).length;
  
  let type: RailConfig['type'] = 'single';
  
  if (connectionCount === 0) {
    type = 'single';
  } else if (connectionCount === 1) {
    type = 'end';
  } else if (connectionCount === 2) {
    // Check for straight or curve
    if (adj.north && adj.south) {
      type = 'straight_ns';
    } else if (adj.east && adj.west) {
      type = 'straight_ew';
    } else if (adj.north && adj.east) {
      type = 'curve_ne';
    } else if (adj.north && adj.west) {
      type = 'curve_nw';
    } else if (adj.south && adj.east) {
      type = 'curve_se';
    } else if (adj.south && adj.west) {
      type = 'curve_sw';
    }
  } else if (connectionCount === 3) {
    type = 'junction_t';
  } else if (connectionCount === 4) {
    type = 'junction_cross';
  }
  
  return {
    ...adj,
    type,
    connectionCount,
  };
}

// ============================================================================
// Rail Drawing Functions
// ============================================================================

/**
 * Draw a railroad tie (sleeper)
 */
function drawTie(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  length: number,
  width: number
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  
  // Main tie
  ctx.fillStyle = RAIL_COLORS.TIE;
  ctx.fillRect(-length / 2, -width / 2, length, width);
  
  // Dark edge for depth
  ctx.fillStyle = RAIL_COLORS.TIE_DARK;
  ctx.fillRect(-length / 2, width / 2 - 1, length, 1);
  
  ctx.restore();
}

/**
 * Draw rail tracks along a line segment
 */
function drawRailSegment(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  trackSpacing: number,
  zoom: number
): void {
  const dx = endX - startX;
  const dy = endY - startY;
  const length = Math.hypot(dx, dy);
  const dirX = dx / length;
  const dirY = dy / length;
  
  // Perpendicular for track offset
  const perpX = -dirY;
  const perpY = dirX;
  
  // Calculate tie angle (perpendicular to track direction)
  const tieAngle = Math.atan2(dy, dx) + Math.PI / 2;
  
  // Draw ballast (gravel bed) first
  const ballastWidth = TILE_WIDTH * RAIL_CONFIG.BALLAST_WIDTH;
  ctx.fillStyle = RAIL_COLORS.BALLAST;
  ctx.beginPath();
  ctx.moveTo(startX + perpX * ballastWidth / 2, startY + perpY * ballastWidth / 2);
  ctx.lineTo(endX + perpX * ballastWidth / 2, endY + perpY * ballastWidth / 2);
  ctx.lineTo(endX - perpX * ballastWidth / 2, endY - perpY * ballastWidth / 2);
  ctx.lineTo(startX - perpX * ballastWidth / 2, startY - perpY * ballastWidth / 2);
  ctx.closePath();
  ctx.fill();
  
  // Draw ties (wooden sleepers)
  const tieSpacing = TILE_WIDTH * RAIL_CONFIG.TIE_SPACING;
  const tieWidth = TILE_WIDTH * RAIL_CONFIG.TIE_WIDTH;
  const tieLength = trackSpacing * 2.2;
  const numTies = Math.floor(length / tieSpacing);
  
  if (zoom >= 0.5) {
    for (let i = 0; i <= numTies; i++) {
      const t = i / Math.max(numTies, 1);
      const tieX = startX + dx * t;
      const tieY = startY + dy * t;
      drawTie(ctx, tieX, tieY, tieAngle, tieLength, tieWidth);
    }
  }
  
  // Draw the two rail tracks
  const railOffset = trackSpacing / 2;
  const railWidth = TILE_WIDTH * RAIL_CONFIG.RAIL_WIDTH;
  
  // Left rail
  ctx.strokeStyle = RAIL_COLORS.RAIL;
  ctx.lineWidth = railWidth * 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(startX + perpX * railOffset, startY + perpY * railOffset);
  ctx.lineTo(endX + perpX * railOffset, endY + perpY * railOffset);
  ctx.stroke();
  
  // Right rail
  ctx.beginPath();
  ctx.moveTo(startX - perpX * railOffset, startY - perpY * railOffset);
  ctx.lineTo(endX - perpX * railOffset, endY - perpY * railOffset);
  ctx.stroke();
  
  // Rail highlight (inner edge)
  if (zoom >= 0.6) {
    ctx.strokeStyle = RAIL_COLORS.RAIL_HIGHLIGHT;
    ctx.lineWidth = railWidth * 0.6;
    
    ctx.beginPath();
    ctx.moveTo(startX + perpX * railOffset, startY + perpY * railOffset);
    ctx.lineTo(endX + perpX * railOffset, endY + perpY * railOffset);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(startX - perpX * railOffset, startY - perpY * railOffset);
    ctx.lineTo(endX - perpX * railOffset, endY - perpY * railOffset);
    ctx.stroke();
  }
}

/**
 * Draw curved rail segment using quadratic bezier
 */
function drawCurvedRailSegment(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  controlX: number,
  controlY: number,
  endX: number,
  endY: number,
  trackSpacing: number,
  zoom: number
): void {
  // Draw ballast along curve
  const ballastWidth = TILE_WIDTH * RAIL_CONFIG.BALLAST_WIDTH;
  
  // Sample points along the curve for ballast and ties
  const numSamples = 12;
  const points: { x: number; y: number; dx: number; dy: number }[] = [];
  
  for (let i = 0; i <= numSamples; i++) {
    const t = i / numSamples;
    const t2 = t * t;
    const mt = 1 - t;
    const mt2 = mt * mt;
    
    // Quadratic bezier point
    const x = mt2 * startX + 2 * mt * t * controlX + t2 * endX;
    const y = mt2 * startY + 2 * mt * t * controlY + t2 * endY;
    
    // Derivative for tangent direction
    const dx = 2 * mt * (controlX - startX) + 2 * t * (endX - controlX);
    const dy = 2 * mt * (controlY - startY) + 2 * t * (endY - controlY);
    const len = Math.hypot(dx, dy);
    
    points.push({ x, y, dx: dx / len, dy: dy / len });
  }
  
  // Draw ballast as polygon
  ctx.fillStyle = RAIL_COLORS.BALLAST;
  ctx.beginPath();
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const px = -p.dy * ballastWidth / 2;
    const py = p.dx * ballastWidth / 2;
    if (i === 0) {
      ctx.moveTo(p.x + px, p.y + py);
    } else {
      ctx.lineTo(p.x + px, p.y + py);
    }
  }
  for (let i = points.length - 1; i >= 0; i--) {
    const p = points[i];
    const px = -p.dy * ballastWidth / 2;
    const py = p.dx * ballastWidth / 2;
    ctx.lineTo(p.x - px, p.y - py);
  }
  ctx.closePath();
  ctx.fill();
  
  // Draw ties along curve
  if (zoom >= 0.5) {
    const tieWidth = TILE_WIDTH * RAIL_CONFIG.TIE_WIDTH;
    const tieLength = trackSpacing * 2.2;
    
    for (let i = 0; i < points.length; i += 2) {
      const p = points[i];
      const tieAngle = Math.atan2(p.dy, p.dx) + Math.PI / 2;
      drawTie(ctx, p.x, p.y, tieAngle, tieLength, tieWidth);
    }
  }
  
  // Draw rails along curve
  const railOffset = trackSpacing / 2;
  const railWidth = TILE_WIDTH * RAIL_CONFIG.RAIL_WIDTH;
  
  ctx.strokeStyle = RAIL_COLORS.RAIL;
  ctx.lineWidth = railWidth * 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  // Left rail
  ctx.beginPath();
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const px = -p.dy * railOffset;
    const py = p.dx * railOffset;
    if (i === 0) {
      ctx.moveTo(p.x + px, p.y + py);
    } else {
      ctx.lineTo(p.x + px, p.y + py);
    }
  }
  ctx.stroke();
  
  // Right rail
  ctx.beginPath();
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const px = -p.dy * railOffset;
    const py = p.dx * railOffset;
    if (i === 0) {
      ctx.moveTo(p.x - px, p.y - py);
    } else {
      ctx.lineTo(p.x - px, p.y - py);
    }
  }
  ctx.stroke();
  
  // Rail highlight
  if (zoom >= 0.6) {
    ctx.strokeStyle = RAIL_COLORS.RAIL_HIGHLIGHT;
    ctx.lineWidth = railWidth * 0.6;
    
    ctx.beginPath();
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const px = -p.dy * railOffset;
      const py = p.dx * railOffset;
      if (i === 0) {
        ctx.moveTo(p.x + px, p.y + py);
      } else {
        ctx.lineTo(p.x + px, p.y + py);
      }
    }
    ctx.stroke();
    
    ctx.beginPath();
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const px = -p.dy * railOffset;
      const py = p.dx * railOffset;
      if (i === 0) {
        ctx.moveTo(p.x - px, p.y - py);
      } else {
        ctx.lineTo(p.x - px, p.y - py);
      }
    }
    ctx.stroke();
  }
}

/**
 * Draw rail track on a tile
 */
export function drawRail(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  config: RailConfig,
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
  
  // Edge midpoints (where tracks connect)
  const northEdgeX = x + w * 0.25;
  const northEdgeY = y + h * 0.25;
  const eastEdgeX = x + w * 0.75;
  const eastEdgeY = y + h * 0.25;
  const southEdgeX = x + w * 0.75;
  const southEdgeY = y + h * 0.75;
  const westEdgeX = x + w * 0.25;
  const westEdgeY = y + h * 0.75;
  
  const trackSpacing = w * RAIL_CONFIG.TRACK_SPACING;
  
  // Draw based on configuration type
  switch (config.type) {
    case 'straight_ns':
      // North-South straight track
      drawRailSegment(ctx, northEdgeX, northEdgeY, southEdgeX, southEdgeY, trackSpacing, zoom);
      break;
      
    case 'straight_ew':
      // East-West straight track
      drawRailSegment(ctx, eastEdgeX, eastEdgeY, westEdgeX, westEdgeY, trackSpacing, zoom);
      break;
      
    case 'curve_ne':
      // North to East curve
      drawCurvedRailSegment(ctx, northEdgeX, northEdgeY, cx, cy, eastEdgeX, eastEdgeY, trackSpacing, zoom);
      break;
      
    case 'curve_nw':
      // North to West curve
      drawCurvedRailSegment(ctx, northEdgeX, northEdgeY, cx, cy, westEdgeX, westEdgeY, trackSpacing, zoom);
      break;
      
    case 'curve_se':
      // South to East curve
      drawCurvedRailSegment(ctx, southEdgeX, southEdgeY, cx, cy, eastEdgeX, eastEdgeY, trackSpacing, zoom);
      break;
      
    case 'curve_sw':
      // South to West curve
      drawCurvedRailSegment(ctx, southEdgeX, southEdgeY, cx, cy, westEdgeX, westEdgeY, trackSpacing, zoom);
      break;
      
    case 'junction_t':
    case 'junction_cross':
      // Draw all connected directions
      if (config.north) {
        drawRailSegment(ctx, cx, cy, northEdgeX, northEdgeY, trackSpacing, zoom);
      }
      if (config.east) {
        drawRailSegment(ctx, cx, cy, eastEdgeX, eastEdgeY, trackSpacing, zoom);
      }
      if (config.south) {
        drawRailSegment(ctx, cx, cy, southEdgeX, southEdgeY, trackSpacing, zoom);
      }
      if (config.west) {
        drawRailSegment(ctx, cx, cy, westEdgeX, westEdgeY, trackSpacing, zoom);
      }
      break;
      
    case 'end':
      // Single connection - draw to center
      if (config.north) {
        drawRailSegment(ctx, cx, cy, northEdgeX, northEdgeY, trackSpacing, zoom);
      } else if (config.east) {
        drawRailSegment(ctx, cx, cy, eastEdgeX, eastEdgeY, trackSpacing, zoom);
      } else if (config.south) {
        drawRailSegment(ctx, cx, cy, southEdgeX, southEdgeY, trackSpacing, zoom);
      } else if (config.west) {
        drawRailSegment(ctx, cx, cy, westEdgeX, westEdgeY, trackSpacing, zoom);
      }
      // Draw a buffer stop at the end
      drawBufferStop(ctx, cx, cy, config, zoom);
      break;
      
    case 'single':
    default:
      // No connections - draw a small isolated section
      drawRailSegment(ctx, cx - w * 0.15, cy - h * 0.075, cx + w * 0.15, cy + h * 0.075, trackSpacing, zoom);
      drawBufferStop(ctx, cx - w * 0.15, cy - h * 0.075, { north: true, east: false, south: false, west: false, type: 'single', connectionCount: 0 }, zoom);
      drawBufferStop(ctx, cx + w * 0.15, cy + h * 0.075, { north: false, east: false, south: true, west: false, type: 'single', connectionCount: 0 }, zoom);
      break;
  }
}

/**
 * Draw a buffer stop (end of track marker)
 */
function drawBufferStop(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  config: RailConfig,
  zoom: number
): void {
  if (zoom < 0.6) return;
  
  // Determine direction
  let angle = 0;
  if (config.north) angle = Math.PI * 0.75;
  else if (config.east) angle = Math.PI * 0.25;
  else if (config.south) angle = -Math.PI * 0.25;
  else if (config.west) angle = -Math.PI * 0.75;
  
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  
  // Draw buffer stop
  ctx.fillStyle = '#ef4444'; // Red buffer
  ctx.fillRect(-3, -5, 6, 10);
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(-2, -4, 4, 8);
  
  ctx.restore();
}

// ============================================================================
// Train Movement Functions
// ============================================================================

/**
 * Get available rail direction options from a tile
 */
export function getRailDirectionOptions(
  grid: Tile[][],
  gridSize: number,
  x: number,
  y: number
): CarDirection[] {
  const options: CarDirection[] = [];
  if (isRailNetworkTile(grid, gridSize, x - 1, y)) options.push('north');
  if (isRailNetworkTile(grid, gridSize, x, y - 1)) options.push('east');
  if (isRailNetworkTile(grid, gridSize, x + 1, y)) options.push('south');
  if (isRailNetworkTile(grid, gridSize, x, y + 1)) options.push('west');
  return options;
}

/**
 * Pick next direction for train movement
 */
export function pickNextRailDirection(
  previousDirection: CarDirection,
  grid: Tile[][],
  gridSize: number,
  x: number,
  y: number
): CarDirection | null {
  const options = getRailDirectionOptions(grid, gridSize, x, y);
  if (options.length === 0) return null;
  
  const incoming = OPPOSITE_DIRECTION[previousDirection];
  const filtered = options.filter(dir => dir !== incoming);
  const pool = filtered.length > 0 ? filtered : options;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Spawn a new train on the rail network
 */
export function spawnTrain(
  grid: Tile[][],
  gridSize: number,
  trainIdRef: { current: number }
): Train | null {
  // Find all rail tiles
  const railTiles: { x: number; y: number }[] = [];
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      if (isRailTile(grid, gridSize, x, y)) {
        railTiles.push({ x, y });
      }
    }
  }
  
  if (railTiles.length === 0) return null;
  
  // Try to find a valid spawn point
  for (let attempt = 0; attempt < 20; attempt++) {
    const tile = railTiles[Math.floor(Math.random() * railTiles.length)];
    const options = getRailDirectionOptions(grid, gridSize, tile.x, tile.y);
    
    if (options.length === 0) continue;
    
    const direction = options[Math.floor(Math.random() * options.length)];
    
    return {
      id: trainIdRef.current++,
      tileX: tile.x,
      tileY: tile.y,
      direction,
      progress: Math.random() * 0.5,
      speed: TRAIN_SPEED_MIN + Math.random() * (TRAIN_SPEED_MAX - TRAIN_SPEED_MIN),
      age: 0,
      maxAge: 3600 + Math.random() * 3600, // 1-2 minutes at normal speed
      color: TRAIN_COLORS[Math.floor(Math.random() * TRAIN_COLORS.length)],
      length: 1 + Math.floor(Math.random() * 3), // 1-3 train cars
    };
  }
  
  return null;
}

/**
 * Draw a train on the canvas
 */
export function drawTrain(
  ctx: CanvasRenderingContext2D,
  train: Train,
  zoom: number
): void {
  const meta = DIRECTION_META[train.direction];
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  
  // Calculate screen position from grid position
  const screenX = (train.tileX - train.tileY) * (w / 2);
  const screenY = (train.tileX + train.tileY) * (h / 2);
  
  const centerX = screenX + w / 2;
  const centerY = screenY + h / 2;
  
  // Position along the tile based on progress
  const trainX = centerX + meta.vec.dx * train.progress;
  const trainY = centerY + meta.vec.dy * train.progress;
  
  ctx.save();
  ctx.translate(trainX, trainY);
  ctx.rotate(meta.angle);
  
  const scale = 0.6;
  const carLength = 16 * scale;
  const carWidth = 6 * scale;
  const carSpacing = 4 * scale;
  
  // Draw each train car (from back to front)
  for (let i = train.length - 1; i >= 0; i--) {
    const carOffset = i * (carLength + carSpacing);
    
    ctx.save();
    ctx.translate(-carOffset, 0);
    
    // Train car body
    ctx.fillStyle = train.color;
    ctx.beginPath();
    ctx.roundRect(-carLength / 2, -carWidth / 2, carLength, carWidth, 2 * scale);
    ctx.fill();
    
    // Roof detail
    ctx.fillStyle = adjustColor(train.color, -20);
    ctx.fillRect(-carLength / 2 + 2 * scale, -carWidth / 2 + 1 * scale, carLength - 4 * scale, carWidth - 2 * scale);
    
    // Windows (only on locomotive - first car)
    if (i === 0) {
      ctx.fillStyle = 'rgba(200, 230, 255, 0.8)';
      ctx.fillRect(carLength / 2 - 4 * scale, -carWidth / 2 + 1 * scale, 3 * scale, carWidth - 2 * scale);
      
      // Front detail
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(carLength / 2 - 1 * scale, -carWidth / 2, 1 * scale, carWidth);
    } else {
      // Passenger windows
      ctx.fillStyle = 'rgba(200, 230, 255, 0.6)';
      const windowSpacing = 3 * scale;
      const numWindows = 3;
      for (let w = 0; w < numWindows; w++) {
        const windowX = -carLength / 2 + 3 * scale + w * windowSpacing;
        ctx.fillRect(windowX, -carWidth / 2 + 1 * scale, 2 * scale, carWidth - 2 * scale);
      }
    }
    
    // Wheels (simple rectangles for isometric view)
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(-carLength / 2 + 1 * scale, carWidth / 2, 3 * scale, 1.5 * scale);
    ctx.fillRect(carLength / 2 - 4 * scale, carWidth / 2, 3 * scale, 1.5 * scale);
    
    ctx.restore();
  }
  
  ctx.restore();
}

/**
 * Utility function to adjust color brightness
 */
function adjustColor(color: string, amount: number): string {
  const hex = color.replace('#', '');
  const r = Math.max(0, Math.min(255, parseInt(hex.substring(0, 2), 16) + amount));
  const g = Math.max(0, Math.min(255, parseInt(hex.substring(2, 4), 16) + amount));
  const b = Math.max(0, Math.min(255, parseInt(hex.substring(4, 6), 16) + amount));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
