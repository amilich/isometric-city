/**
 * Coaster Track Drawing System
 * Draws roller coaster tracks using canvas geometry (not sprites)
 * Inspired by the rail system but with 3D height support
 */

// =============================================================================
// CONSTANTS
// =============================================================================

const TILE_WIDTH = 64;
const HEIGHT_RATIO = 0.60;
const TILE_HEIGHT = TILE_WIDTH * HEIGHT_RATIO;

// Track visual parameters
const TRACK_WIDTH = 8; // Width of the track rails
const RAIL_WIDTH = 2; // Width of individual rails
const TIE_LENGTH = 12; // Length of crossties
const TIE_SPACING = 8; // Space between crossties
const SUPPORT_WIDTH = 4; // Width of support columns

// Height unit in pixels (for vertical track elements)
const HEIGHT_UNIT = 20;

// Colors
const COLORS = {
  rail: '#4b5563', // Gray steel
  railHighlight: '#6b7280',
  tie: '#78350f', // Brown wood
  support: '#374151', // Dark gray
  supportHighlight: '#4b5563',
};

// =============================================================================
// ISOMETRIC HELPERS
// =============================================================================

/** Convert grid coordinates to screen position */
function gridToScreen(gridX: number, gridY: number): { x: number; y: number } {
  const x = (gridX - gridY) * (TILE_WIDTH / 2);
  const y = (gridX + gridY) * (TILE_HEIGHT / 2);
  return { x, y };
}

/** Get screen position with height offset */
function gridToScreen3D(gridX: number, gridY: number, height: number): { x: number; y: number } {
  const { x, y } = gridToScreen(gridX, gridY);
  return { x, y: y - height * HEIGHT_UNIT };
}

/** Isometric direction vectors (normalized) */
const DIRECTIONS = {
  north: { dx: -0.7071, dy: -0.4243 }, // NW
  east: { dx: 0.7071, dy: -0.4243 },   // NE
  south: { dx: 0.7071, dy: 0.4243 },   // SE
  west: { dx: -0.7071, dy: 0.4243 },   // SW
};

// =============================================================================
// BEZIER CURVE HELPERS
// =============================================================================

interface Point { x: number; y: number }

function bezierPoint(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;
  
  return {
    x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
    y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y,
  };
}

function bezierTangent(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  
  return {
    x: 3 * uu * (p1.x - p0.x) + 6 * u * t * (p2.x - p1.x) + 3 * tt * (p3.x - p2.x),
    y: 3 * uu * (p1.y - p0.y) + 6 * u * t * (p2.y - p1.y) + 3 * tt * (p3.y - p2.y),
  };
}

// =============================================================================
// TRACK SEGMENT TYPES
// =============================================================================

export type TrackDirection = 'north' | 'east' | 'south' | 'west';

export interface TrackSegment {
  type: 'straight' | 'turn_left' | 'turn_right' | 'slope_up' | 'slope_down' | 'lift_hill';
  startDir: TrackDirection;
  endDir: TrackDirection;
  startHeight: number;
  endHeight: number;
  chainLift?: boolean;
}

// =============================================================================
// DRAWING FUNCTIONS
// =============================================================================

/**
 * Draw a straight track segment
 */
export function drawStraightTrack(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  direction: TrackDirection,
  height: number,
  trackColor: string = COLORS.rail
) {
  const dir = DIRECTIONS[direction];
  const length = TILE_WIDTH * 0.8;
  
  const centerX = startX + TILE_WIDTH / 2;
  const centerY = startY + TILE_HEIGHT / 2 - height * HEIGHT_UNIT;
  
  const halfLen = length / 2;
  const x1 = centerX - dir.dx * halfLen;
  const y1 = centerY - dir.dy * halfLen;
  const x2 = centerX + dir.dx * halfLen;
  const y2 = centerY + dir.dy * halfLen;
  
  // Draw support column if elevated
  if (height > 0) {
    drawSupport(ctx, centerX, centerY + height * HEIGHT_UNIT, height);
  }
  
  // Draw crossties
  const perpX = -dir.dy;
  const perpY = dir.dx;
  const numTies = Math.floor(length / TIE_SPACING);
  
  ctx.strokeStyle = COLORS.tie;
  ctx.lineWidth = 3;
  ctx.lineCap = 'butt';
  
  for (let i = 0; i <= numTies; i++) {
    const t = i / numTies;
    const tieX = x1 + (x2 - x1) * t;
    const tieY = y1 + (y2 - y1) * t;
    
    ctx.beginPath();
    ctx.moveTo(tieX - perpX * TIE_LENGTH / 2, tieY - perpY * TIE_LENGTH / 2);
    ctx.lineTo(tieX + perpX * TIE_LENGTH / 2, tieY + perpY * TIE_LENGTH / 2);
    ctx.stroke();
  }
  
  // Draw rails
  const railOffset = TRACK_WIDTH / 2;
  
  ctx.strokeStyle = trackColor;
  ctx.lineWidth = RAIL_WIDTH;
  ctx.lineCap = 'round';
  
  // Left rail
  ctx.beginPath();
  ctx.moveTo(x1 - perpX * railOffset, y1 - perpY * railOffset);
  ctx.lineTo(x2 - perpX * railOffset, y2 - perpY * railOffset);
  ctx.stroke();
  
  // Right rail
  ctx.beginPath();
  ctx.moveTo(x1 + perpX * railOffset, y1 + perpY * railOffset);
  ctx.lineTo(x2 + perpX * railOffset, y2 + perpY * railOffset);
  ctx.stroke();
}

/**
 * Draw a curved track segment (turn)
 */
export function drawCurvedTrack(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  startDir: TrackDirection,
  turnRight: boolean,
  height: number,
  trackColor: string = COLORS.rail
) {
  const centerX = startX + TILE_WIDTH / 2;
  const centerY = startY + TILE_HEIGHT / 2 - height * HEIGHT_UNIT;
  
  const startVec = DIRECTIONS[startDir];
  
  // Calculate control points for bezier curve
  const radius = TILE_WIDTH * 0.4;
  const turnMult = turnRight ? 1 : -1;
  
  // Perpendicular direction
  const perpX = -startVec.dy * turnMult;
  const perpY = startVec.dx * turnMult;
  
  // Start and end points
  const p0: Point = {
    x: centerX - startVec.dx * radius,
    y: centerY - startVec.dy * radius,
  };
  
  const p3: Point = {
    x: centerX + perpX * radius,
    y: centerY + perpY * radius,
  };
  
  // Control points
  const p1: Point = {
    x: p0.x + startVec.dx * radius * 0.5,
    y: p0.y + startVec.dy * radius * 0.5,
  };
  
  const p2: Point = {
    x: p3.x - perpX * radius * 0.5,
    y: p3.y - perpY * radius * 0.5,
  };
  
  // Draw support if elevated
  if (height > 0) {
    drawSupport(ctx, centerX, centerY + height * HEIGHT_UNIT, height);
  }
  
  // Draw crossties along curve
  const numTies = 8;
  ctx.strokeStyle = COLORS.tie;
  ctx.lineWidth = 3;
  
  for (let i = 0; i <= numTies; i++) {
    const t = i / numTies;
    const pt = bezierPoint(p0, p1, p2, p3, t);
    const tangent = bezierTangent(p0, p1, p2, p3, t);
    const len = Math.sqrt(tangent.x * tangent.x + tangent.y * tangent.y);
    const perpTieX = -tangent.y / len;
    const perpTieY = tangent.x / len;
    
    ctx.beginPath();
    ctx.moveTo(pt.x - perpTieX * TIE_LENGTH / 2, pt.y - perpTieY * TIE_LENGTH / 2);
    ctx.lineTo(pt.x + perpTieX * TIE_LENGTH / 2, pt.y + perpTieY * TIE_LENGTH / 2);
    ctx.stroke();
  }
  
  // Draw rails
  const railOffset = TRACK_WIDTH / 2;
  const segments = 20;
  
  ctx.strokeStyle = trackColor;
  ctx.lineWidth = RAIL_WIDTH;
  ctx.lineCap = 'round';
  
  // Left and right rail paths
  for (const side of [-1, 1]) {
    ctx.beginPath();
    
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const pt = bezierPoint(p0, p1, p2, p3, t);
      const tangent = bezierTangent(p0, p1, p2, p3, t);
      const len = Math.sqrt(tangent.x * tangent.x + tangent.y * tangent.y);
      const perpRailX = -tangent.y / len;
      const perpRailY = tangent.x / len;
      
      const rx = pt.x + perpRailX * railOffset * side;
      const ry = pt.y + perpRailY * railOffset * side;
      
      if (i === 0) {
        ctx.moveTo(rx, ry);
      } else {
        ctx.lineTo(rx, ry);
      }
    }
    
    ctx.stroke();
  }
}

/**
 * Draw a sloped track segment
 */
export function drawSlopeTrack(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  direction: TrackDirection,
  startHeight: number,
  endHeight: number,
  trackColor: string = COLORS.rail
) {
  const dir = DIRECTIONS[direction];
  const length = TILE_WIDTH * 0.8;
  
  const centerX = startX + TILE_WIDTH / 2;
  const centerY = startY + TILE_HEIGHT / 2;
  
  const halfLen = length / 2;
  const x1 = centerX - dir.dx * halfLen;
  const y1 = centerY - dir.dy * halfLen - startHeight * HEIGHT_UNIT;
  const x2 = centerX + dir.dx * halfLen;
  const y2 = centerY + dir.dy * halfLen - endHeight * HEIGHT_UNIT;
  
  // Draw supports at start and end if elevated
  if (startHeight > 0) {
    drawSupport(ctx, x1, centerY - dir.dy * halfLen, startHeight);
  }
  if (endHeight > 0) {
    drawSupport(ctx, x2, centerY + dir.dy * halfLen, endHeight);
  }
  
  // Draw crossties
  const perpX = -dir.dy;
  const perpY = dir.dx;
  const numTies = Math.floor(length / TIE_SPACING);
  
  ctx.strokeStyle = COLORS.tie;
  ctx.lineWidth = 3;
  ctx.lineCap = 'butt';
  
  for (let i = 0; i <= numTies; i++) {
    const t = i / numTies;
    const tieX = x1 + (x2 - x1) * t;
    const tieY = y1 + (y2 - y1) * t;
    
    ctx.beginPath();
    ctx.moveTo(tieX - perpX * TIE_LENGTH / 2, tieY - perpY * TIE_LENGTH / 2);
    ctx.lineTo(tieX + perpX * TIE_LENGTH / 2, tieY + perpY * TIE_LENGTH / 2);
    ctx.stroke();
  }
  
  // Draw rails
  const railOffset = TRACK_WIDTH / 2;
  
  ctx.strokeStyle = trackColor;
  ctx.lineWidth = RAIL_WIDTH;
  ctx.lineCap = 'round';
  
  // Left rail
  ctx.beginPath();
  ctx.moveTo(x1 - perpX * railOffset, y1 - perpY * railOffset);
  ctx.lineTo(x2 - perpX * railOffset, y2 - perpY * railOffset);
  ctx.stroke();
  
  // Right rail
  ctx.beginPath();
  ctx.moveTo(x1 + perpX * railOffset, y1 + perpY * railOffset);
  ctx.lineTo(x2 + perpX * railOffset, y2 + perpY * railOffset);
  ctx.stroke();
}

/**
 * Draw a support column
 */
function drawSupport(
  ctx: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  height: number
) {
  if (height <= 0) return;
  
  const topY = groundY - height * HEIGHT_UNIT;
  
  // Main support column
  ctx.fillStyle = COLORS.support;
  ctx.strokeStyle = COLORS.supportHighlight;
  ctx.lineWidth = 1;
  
  // Draw column with slight 3D effect
  const columnWidth = SUPPORT_WIDTH;
  
  ctx.beginPath();
  ctx.moveTo(x - columnWidth / 2, topY);
  ctx.lineTo(x - columnWidth / 2, groundY);
  ctx.lineTo(x + columnWidth / 2, groundY);
  ctx.lineTo(x + columnWidth / 2, topY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  
  // Cross bracing for tall supports
  if (height > 2) {
    ctx.strokeStyle = COLORS.support;
    ctx.lineWidth = 1;
    
    const numBraces = Math.floor(height / 2);
    const braceHeight = (height * HEIGHT_UNIT) / (numBraces + 1);
    
    for (let i = 1; i <= numBraces; i++) {
      const braceY = topY + braceHeight * i;
      ctx.beginPath();
      ctx.moveTo(x - columnWidth * 2, braceY);
      ctx.lineTo(x + columnWidth * 2, braceY);
      ctx.stroke();
    }
  }
}

/**
 * Draw a loop section (simplified vertical loop)
 */
export function drawLoopTrack(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  direction: TrackDirection,
  loopHeight: number,
  trackColor: string = COLORS.rail
) {
  const centerX = startX + TILE_WIDTH / 2;
  const centerY = startY + TILE_HEIGHT / 2;
  
  const loopRadius = loopHeight * HEIGHT_UNIT * 0.4;
  const loopCenterY = centerY - loopHeight * HEIGHT_UNIT / 2;
  
  // Draw loop circle
  const numSegments = 32;
  const railOffset = TRACK_WIDTH / 2;
  
  // Draw crossties around the loop
  ctx.strokeStyle = COLORS.tie;
  ctx.lineWidth = 2;
  
  for (let i = 0; i < numSegments; i += 2) {
    const angle = (i / numSegments) * Math.PI * 2;
    const px = centerX + Math.cos(angle) * loopRadius;
    const py = loopCenterY + Math.sin(angle) * loopRadius * 0.6; // Flatten for isometric
    
    const tangentX = -Math.sin(angle);
    const tangentY = Math.cos(angle) * 0.6;
    const len = Math.sqrt(tangentX * tangentX + tangentY * tangentY);
    
    ctx.beginPath();
    ctx.moveTo(px - tangentX / len * TIE_LENGTH / 2, py - tangentY / len * TIE_LENGTH / 2);
    ctx.lineTo(px + tangentX / len * TIE_LENGTH / 2, py + tangentY / len * TIE_LENGTH / 2);
    ctx.stroke();
  }
  
  // Draw rails
  ctx.strokeStyle = trackColor;
  ctx.lineWidth = RAIL_WIDTH;
  
  for (const railSide of [-1, 1]) {
    ctx.beginPath();
    
    for (let i = 0; i <= numSegments; i++) {
      const angle = (i / numSegments) * Math.PI * 2;
      const rx = centerX + Math.cos(angle) * (loopRadius + railOffset * railSide);
      const ry = loopCenterY + Math.sin(angle) * (loopRadius + railOffset * railSide) * 0.6;
      
      if (i === 0) {
        ctx.moveTo(rx, ry);
      } else {
        ctx.lineTo(rx, ry);
      }
    }
    
    ctx.stroke();
  }
  
  // Draw support structure
  drawSupport(ctx, centerX, centerY, loopHeight);
}

// =============================================================================
// CHAIN LIFT DRAWING
// =============================================================================

/**
 * Draw chain lift markings on a track segment
 */
export function drawChainLift(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  direction: TrackDirection,
  height: number,
  tickOffset: number = 0
) {
  const dir = DIRECTIONS[direction];
  const length = TILE_WIDTH * 0.7;
  
  const centerX = startX + TILE_WIDTH / 2;
  const centerY = startY + TILE_HEIGHT / 2 - height * HEIGHT_UNIT;
  
  const halfLen = length / 2;
  const x1 = centerX - dir.dx * halfLen;
  const y1 = centerY - dir.dy * halfLen;
  const x2 = centerX + dir.dx * halfLen;
  const y2 = centerY + dir.dy * halfLen;
  
  // Draw chain links
  ctx.strokeStyle = '#1f2937';
  ctx.lineWidth = 1;
  
  const linkSpacing = 4;
  const numLinks = Math.floor(length / linkSpacing);
  const animOffset = (tickOffset % linkSpacing);
  
  for (let i = 0; i <= numLinks; i++) {
    const t = (i * linkSpacing + animOffset) / length;
    if (t > 1) continue;
    
    const linkX = x1 + (x2 - x1) * t;
    const linkY = y1 + (y2 - y1) * t;
    
    ctx.beginPath();
    ctx.arc(linkX, linkY, 1.5, 0, Math.PI * 2);
    ctx.stroke();
  }
}
