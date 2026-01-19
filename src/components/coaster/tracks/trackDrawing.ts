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
const SUPPORT_WIDTH = 2; // Width of support columns (thinner)

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
 * Uses edge midpoints like the city game's rail system for proper alignment with curves
 */
export function drawStraightTrack(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  direction: TrackDirection,
  height: number,
  trackColor: string = COLORS.rail
) {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const heightOffset = height * HEIGHT_UNIT;
  
  // Edge midpoints - MUST match curve endpoints (like city game's rail system)
  const northEdge = { x: startX + w * 0.25, y: startY + h * 0.25 - heightOffset };
  const eastEdge = { x: startX + w * 0.75, y: startY + h * 0.25 - heightOffset };
  const southEdge = { x: startX + w * 0.75, y: startY + h * 0.75 - heightOffset };
  const westEdge = { x: startX + w * 0.25, y: startY + h * 0.75 - heightOffset };
  const center = { x: startX + w / 2, y: startY + h / 2 - heightOffset };
  
  // Determine endpoints based on direction
  // For N-S track, direction is 'north' or 'south' (the exit direction)
  let fromEdge: Point;
  let toEdge: Point;
  let perpX: number;
  let perpY: number;
  
  if (direction === 'north' || direction === 'south') {
    // Track runs N-S
    fromEdge = northEdge;
    toEdge = southEdge;
    // Perpendicular is along E-W axis
    perpX = (eastEdge.x - westEdge.x) / Math.hypot(eastEdge.x - westEdge.x, eastEdge.y - westEdge.y);
    perpY = (eastEdge.y - westEdge.y) / Math.hypot(eastEdge.x - westEdge.x, eastEdge.y - westEdge.y);
  } else {
    // Track runs E-W
    fromEdge = eastEdge;
    toEdge = westEdge;
    // Perpendicular is along N-S axis
    perpX = (southEdge.x - northEdge.x) / Math.hypot(southEdge.x - northEdge.x, southEdge.y - northEdge.y);
    perpY = (southEdge.y - northEdge.y) / Math.hypot(southEdge.x - northEdge.x, southEdge.y - northEdge.y);
  }
  
  // Draw support column if elevated
  if (height > 0) {
    drawSupport(ctx, center.x, center.y + heightOffset, height);
  }
  
  // Calculate track length for tie spacing
  const length = Math.hypot(toEdge.x - fromEdge.x, toEdge.y - fromEdge.y);
  const numTies = Math.max(3, Math.floor(length / TIE_SPACING));
  
  // Draw crossties
  ctx.strokeStyle = COLORS.tie;
  ctx.lineWidth = 3;
  ctx.lineCap = 'butt';
  
  for (let i = 0; i <= numTies; i++) {
    const t = i / numTies;
    const tieX = fromEdge.x + (toEdge.x - fromEdge.x) * t;
    const tieY = fromEdge.y + (toEdge.y - fromEdge.y) * t;
    
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
  ctx.moveTo(fromEdge.x - perpX * railOffset, fromEdge.y - perpY * railOffset);
  ctx.lineTo(toEdge.x - perpX * railOffset, toEdge.y - perpY * railOffset);
  ctx.stroke();
  
  // Right rail
  ctx.beginPath();
  ctx.moveTo(fromEdge.x + perpX * railOffset, fromEdge.y + perpY * railOffset);
  ctx.lineTo(toEdge.x + perpX * railOffset, toEdge.y + perpY * railOffset);
  ctx.stroke();
}

/**
 * Draw a curved track segment (turn)
 * Uses quadratic bezier like the city game's rail system for proper alignment
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
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const heightOffset = height * HEIGHT_UNIT;
  
  // Edge midpoints - MUST match where straight tracks end (like city game's rail system)
  const northEdge = { x: startX + w * 0.25, y: startY + h * 0.25 - heightOffset };
  const eastEdge = { x: startX + w * 0.75, y: startY + h * 0.25 - heightOffset };
  const southEdge = { x: startX + w * 0.75, y: startY + h * 0.75 - heightOffset };
  const westEdge = { x: startX + w * 0.25, y: startY + h * 0.75 - heightOffset };
  const center = { x: startX + w / 2, y: startY + h / 2 - heightOffset };
  
  // Determine which edges to connect based on direction and turn
  // startDir is the direction the track is coming FROM
  let fromEdge: Point;
  let toEdge: Point;
  
  if (startDir === 'north') {
    fromEdge = northEdge;
    toEdge = turnRight ? eastEdge : westEdge;
  } else if (startDir === 'south') {
    fromEdge = southEdge;
    toEdge = turnRight ? westEdge : eastEdge;
  } else if (startDir === 'east') {
    fromEdge = eastEdge;
    toEdge = turnRight ? southEdge : northEdge;
  } else { // west
    fromEdge = westEdge;
    toEdge = turnRight ? northEdge : southEdge;
  }
  
  // Draw support if elevated - place under the curve midpoint
  if (height > 0) {
    const midT = 0.5;
    const u = 1 - midT;
    const curveMid = {
      x: u * u * fromEdge.x + 2 * u * midT * center.x + midT * midT * toEdge.x,
      y: u * u * fromEdge.y + 2 * u * midT * center.y + midT * midT * toEdge.y,
    };
    drawSupport(ctx, curveMid.x, curveMid.y + heightOffset, height);
  }
  
  // Draw crossties along the quadratic curve (fewer ties - 4 is enough)
  const numTies = 4;
  ctx.strokeStyle = COLORS.tie;
  ctx.lineWidth = 3;
  
  for (let i = 0; i <= numTies; i++) {
    const t = i / numTies;
    // Quadratic bezier point
    const u = 1 - t;
    const pt = {
      x: u * u * fromEdge.x + 2 * u * t * center.x + t * t * toEdge.x,
      y: u * u * fromEdge.y + 2 * u * t * center.y + t * t * toEdge.y,
    };
    // Quadratic bezier tangent
    const tangent = {
      x: 2 * (1 - t) * (center.x - fromEdge.x) + 2 * t * (toEdge.x - center.x),
      y: 2 * (1 - t) * (center.y - fromEdge.y) + 2 * t * (toEdge.y - center.y),
    };
    const len = Math.sqrt(tangent.x * tangent.x + tangent.y * tangent.y);
    const perpX = -tangent.y / len;
    const perpY = tangent.x / len;
    
    ctx.beginPath();
    ctx.moveTo(pt.x - perpX * TIE_LENGTH / 2, pt.y - perpY * TIE_LENGTH / 2);
    ctx.lineTo(pt.x + perpX * TIE_LENGTH / 2, pt.y + perpY * TIE_LENGTH / 2);
    ctx.stroke();
  }
  
  // Draw rails using quadratic bezier
  const railOffset = TRACK_WIDTH / 2;
  const segments = 16;
  
  ctx.strokeStyle = trackColor;
  ctx.lineWidth = RAIL_WIDTH;
  ctx.lineCap = 'round';
  
  // Left and right rail paths
  for (const side of [-1, 1]) {
    ctx.beginPath();
    
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const u = 1 - t;
      
      // Quadratic bezier point
      const pt = {
        x: u * u * fromEdge.x + 2 * u * t * center.x + t * t * toEdge.x,
        y: u * u * fromEdge.y + 2 * u * t * center.y + t * t * toEdge.y,
      };
      
      // Quadratic bezier tangent
      const tangent = {
        x: 2 * (1 - t) * (center.x - fromEdge.x) + 2 * t * (toEdge.x - center.x),
        y: 2 * (1 - t) * (center.y - fromEdge.y) + 2 * t * (toEdge.y - center.y),
      };
      const len = Math.sqrt(tangent.x * tangent.x + tangent.y * tangent.y);
      const perpX = -tangent.y / len;
      const perpY = tangent.x / len;
      
      const rx = pt.x + perpX * railOffset * side;
      const ry = pt.y + perpY * railOffset * side;
      
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
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  
  // Use edge midpoints like straight track for proper alignment
  const northEdge = { x: startX + w * 0.25, y: startY + h * 0.25 };
  const eastEdge = { x: startX + w * 0.75, y: startY + h * 0.25 };
  const southEdge = { x: startX + w * 0.75, y: startY + h * 0.75 };
  const westEdge = { x: startX + w * 0.25, y: startY + h * 0.75 };
  const center = { x: startX + w / 2, y: startY + h / 2 };
  
  // Determine endpoints based on direction
  // The direction indicates where the track is GOING (exit direction)
  // So 'south' means entering from north, exiting to south
  // 'north' means entering from south, exiting to north
  let fromEdge: Point;
  let toEdge: Point;
  let groundPerpX: number;
  let groundPerpY: number;
  let fromHeight: number;
  let toHeight: number;
  
  if (direction === 'south') {
    // Going south: enter from north (startHeight), exit to south (endHeight)
    fromEdge = northEdge;
    toEdge = southEdge;
    fromHeight = startHeight;
    toHeight = endHeight;
    groundPerpX = (eastEdge.x - westEdge.x) / Math.hypot(eastEdge.x - westEdge.x, eastEdge.y - westEdge.y);
    groundPerpY = (eastEdge.y - westEdge.y) / Math.hypot(eastEdge.x - westEdge.x, eastEdge.y - westEdge.y);
  } else if (direction === 'north') {
    // Going north: enter from south (startHeight), exit to north (endHeight)
    fromEdge = southEdge;
    toEdge = northEdge;
    fromHeight = startHeight;
    toHeight = endHeight;
    groundPerpX = (eastEdge.x - westEdge.x) / Math.hypot(eastEdge.x - westEdge.x, eastEdge.y - westEdge.y);
    groundPerpY = (eastEdge.y - westEdge.y) / Math.hypot(eastEdge.x - westEdge.x, eastEdge.y - westEdge.y);
  } else if (direction === 'west') {
    // Going west: enter from east (startHeight), exit to west (endHeight)
    fromEdge = eastEdge;
    toEdge = westEdge;
    fromHeight = startHeight;
    toHeight = endHeight;
    groundPerpX = (southEdge.x - northEdge.x) / Math.hypot(southEdge.x - northEdge.x, southEdge.y - northEdge.y);
    groundPerpY = (southEdge.y - northEdge.y) / Math.hypot(southEdge.x - northEdge.x, southEdge.y - northEdge.y);
  } else {
    // Going east: enter from west (startHeight), exit to east (endHeight)
    fromEdge = westEdge;
    toEdge = eastEdge;
    fromHeight = startHeight;
    toHeight = endHeight;
    groundPerpX = (southEdge.x - northEdge.x) / Math.hypot(southEdge.x - northEdge.x, southEdge.y - northEdge.y);
    groundPerpY = (southEdge.y - northEdge.y) / Math.hypot(southEdge.x - northEdge.x, southEdge.y - northEdge.y);
  }
  
  // Apply height offsets
  const fromHeightOffset = fromHeight * HEIGHT_UNIT;
  const toHeightOffset = toHeight * HEIGHT_UNIT;
  
  const x1 = fromEdge.x;
  const y1 = fromEdge.y - fromHeightOffset;
  const x2 = toEdge.x;
  const y2 = toEdge.y - toHeightOffset;
  
  // Draw supports at start and end if elevated
  if (fromHeight > 0) {
    drawSupport(ctx, x1, fromEdge.y, fromHeight);
  }
  if (toHeight > 0) {
    drawSupport(ctx, x2, toEdge.y, toHeight);
  }
  
  // Calculate actual track direction vector (including slope)
  const trackDirX = x2 - x1;
  const trackDirY = y2 - y1;
  const trackLen = Math.hypot(trackDirX, trackDirY);
  
  // Perpendicular to the actual sloped track (in 2D screen space)
  // This ensures ties are orthogonal to the track path
  const perpX = -trackDirY / trackLen;
  const perpY = trackDirX / trackLen;
  
  // Draw crossties
  const numTies = Math.max(3, Math.floor(trackLen / TIE_SPACING));
  
  ctx.strokeStyle = COLORS.tie;
  ctx.lineWidth = 3;
  ctx.lineCap = 'butt';
  
  for (let i = 0; i <= numTies; i++) {
    const t = i / numTies;
    const tieX = x1 + trackDirX * t;
    const tieY = y1 + trackDirY * t;
    
    ctx.beginPath();
    ctx.moveTo(tieX - perpX * TIE_LENGTH / 2, tieY - perpY * TIE_LENGTH / 2);
    ctx.lineTo(tieX + perpX * TIE_LENGTH / 2, tieY + perpY * TIE_LENGTH / 2);
    ctx.stroke();
  }
  
  // Draw rails - use ground-plane perpendicular for rail spacing
  // (rails stay horizontal relative to each other, only the track slopes)
  const railOffset = TRACK_WIDTH / 2;
  
  ctx.strokeStyle = trackColor;
  ctx.lineWidth = RAIL_WIDTH;
  ctx.lineCap = 'round';
  
  // Left rail
  ctx.beginPath();
  ctx.moveTo(x1 - groundPerpX * railOffset, y1 - groundPerpY * railOffset);
  ctx.lineTo(x2 - groundPerpX * railOffset, y2 - groundPerpY * railOffset);
  ctx.stroke();
  
  // Right rail
  ctx.beginPath();
  ctx.moveTo(x1 + groundPerpX * railOffset, y1 + groundPerpY * railOffset);
  ctx.lineTo(x2 + groundPerpX * railOffset, y2 + groundPerpY * railOffset);
  ctx.stroke();
}

/**
 * Draw a support column - thin vertical steel columns
 */
function drawSupport(
  ctx: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  height: number
) {
  if (height <= 0) return;
  
  const topY = groundY - height * HEIGHT_UNIT;
  
  // Two thin vertical columns
  const columnSpacing = 4; // Distance between the two columns
  
  ctx.strokeStyle = COLORS.support;
  ctx.lineWidth = SUPPORT_WIDTH;
  ctx.lineCap = 'round';
  
  // Left column
  ctx.beginPath();
  ctx.moveTo(x - columnSpacing, topY);
  ctx.lineTo(x - columnSpacing, groundY);
  ctx.stroke();
  
  // Right column
  ctx.beginPath();
  ctx.moveTo(x + columnSpacing, topY);
  ctx.lineTo(x + columnSpacing, groundY);
  ctx.stroke();
  
  // Horizontal braces connecting the columns
  if (height > 1) {
    ctx.strokeStyle = COLORS.supportHighlight;
    ctx.lineWidth = 1;
    
    const numBraces = Math.max(1, Math.floor(height / 2));
    const supportHeight = groundY - topY;
    
    for (let i = 1; i <= numBraces; i++) {
      const braceY = topY + (supportHeight * i) / (numBraces + 1);
      ctx.beginPath();
      ctx.moveTo(x - columnSpacing, braceY);
      ctx.lineTo(x + columnSpacing, braceY);
      ctx.stroke();
    }
  }
}

/**
 * Draw a vertical loop section
 * A complete vertical circle - train goes up, inverts at top, comes back down
 */
export function drawLoopTrack(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  direction: TrackDirection,
  loopHeight: number,
  trackColor: string = COLORS.rail
) {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const centerX = startX + w / 2;
  const centerY = startY + h / 2;
  
  // Loop radius - make it visible
  const loopRadius = Math.max(28, loopHeight * HEIGHT_UNIT * 0.4);
  const numSegments = 32;
  const railOffset = TRACK_WIDTH / 2;
  
  // Get direction vector for the track
  const dir = DIRECTIONS[direction];
  
  // The loop is a vertical circle in the plane of travel
  // In isometric view, we see it at an angle
  // The circle center is at track level, offset forward by the radius
  
  // For a vertical loop viewed in isometric:
  // - Horizontal displacement (along track direction) = sin(angle) * radius
  // - Vertical displacement (up in screen space) = (1 - cos(angle)) * radius
  // angle 0 = entry (bottom), angle PI = top (inverted), angle 2PI = exit (bottom)
  
  const getLoopPoint = (angle: number, railSide: number = 0): Point => {
    // Forward displacement along track direction
    const forwardOffset = Math.sin(angle) * loopRadius;
    
    // Height displacement (up in screen = negative Y)
    const heightOffset = (1 - Math.cos(angle)) * loopRadius;
    
    // Base position at center of tile
    const baseX = centerX + dir.dx * forwardOffset;
    const baseY = centerY + dir.dy * forwardOffset - heightOffset;
    
    // Rail offset perpendicular to the loop plane (left/right of track)
    // Perpendicular to track direction
    const perpX = -dir.dy;
    const perpY = dir.dx;
    
    return {
      x: baseX + perpX * railOffset * railSide,
      y: baseY + perpY * railOffset * railSide
    };
  };
  
  // Draw support structure first (behind the loop)
  ctx.fillStyle = COLORS.support;
  ctx.strokeStyle = COLORS.supportHighlight;
  ctx.lineWidth = 1;
  
  // Main vertical support column at center
  const supportWidth = 4;
  const supportHeight = loopRadius * 2 + 5;
  
  ctx.beginPath();
  ctx.moveTo(centerX - supportWidth / 2, centerY);
  ctx.lineTo(centerX - supportWidth / 2, centerY - supportHeight);
  ctx.lineTo(centerX + supportWidth / 2, centerY - supportHeight);
  ctx.lineTo(centerX + supportWidth / 2, centerY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  
  // Horizontal braces at different heights
  for (let i = 1; i <= 3; i++) {
    const braceY = centerY - (supportHeight * i / 4);
    const braceWidth = loopRadius * 0.4;
    ctx.beginPath();
    ctx.moveTo(centerX - braceWidth, braceY);
    ctx.lineTo(centerX + braceWidth, braceY);
    ctx.stroke();
  }
  
  // Draw crossties around the full loop
  ctx.strokeStyle = COLORS.tie;
  ctx.lineWidth = 2;
  
  for (let i = 0; i < numSegments; i += 2) {
    const angle = (i / numSegments) * Math.PI * 2;
    const pt = getLoopPoint(angle);
    
    // Calculate tangent for perpendicular tie direction
    const nextAngle = angle + 0.05;
    const nextPt = getLoopPoint(nextAngle);
    const tangentX = nextPt.x - pt.x;
    const tangentY = nextPt.y - pt.y;
    const tangentLen = Math.hypot(tangentX, tangentY);
    
    if (tangentLen > 0.001) {
      // Perpendicular to tangent in the loop plane
      const tieX = -tangentY / tangentLen;
      const tieY = tangentX / tangentLen;
      
      ctx.beginPath();
      ctx.moveTo(pt.x - tieX * TIE_LENGTH * 0.4, pt.y - tieY * TIE_LENGTH * 0.4);
      ctx.lineTo(pt.x + tieX * TIE_LENGTH * 0.4, pt.y + tieY * TIE_LENGTH * 0.4);
      ctx.stroke();
    }
  }
  
  // Draw the two rails as complete circles
  ctx.strokeStyle = trackColor;
  ctx.lineWidth = RAIL_WIDTH;
  ctx.lineCap = 'round';
  
  for (const railSide of [-1, 1]) {
    ctx.beginPath();
    
    for (let i = 0; i <= numSegments; i++) {
      const angle = (i / numSegments) * Math.PI * 2;
      const pt = getLoopPoint(angle, railSide);
      
      if (i === 0) {
        ctx.moveTo(pt.x, pt.y);
      } else {
        ctx.lineTo(pt.x, pt.y);
      }
    }
    
    ctx.closePath();
    ctx.stroke();
  }
}

// =============================================================================
// CHAIN LIFT DRAWING
// =============================================================================

/**
 * Draw chain lift markings on a track segment
 * Supports sloped tracks by interpolating between startHeight and endHeight
 */
export function drawChainLift(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  direction: TrackDirection,
  startHeight: number,
  endHeight: number,
  tickOffset: number = 0
) {
  const dir = DIRECTIONS[direction];
  const length = TILE_WIDTH * 0.7;
  
  const centerX = startX + TILE_WIDTH / 2;
  const centerY = startY + TILE_HEIGHT / 2;
  
  const halfLen = length / 2;
  
  // Calculate start and end points with their respective heights
  const x1 = centerX - dir.dx * halfLen;
  const y1 = centerY - dir.dy * halfLen - startHeight * HEIGHT_UNIT;
  const x2 = centerX + dir.dx * halfLen;
  const y2 = centerY + dir.dy * halfLen - endHeight * HEIGHT_UNIT;
  
  // Draw chain links along the sloped path
  ctx.fillStyle = '#1f2937';
  
  const linkSpacing = 4;
  const numLinks = Math.floor(length / linkSpacing);
  const animOffset = (tickOffset % linkSpacing);
  
  for (let i = 0; i <= numLinks; i++) {
    const t = (i * linkSpacing + animOffset) / length;
    if (t > 1) continue;
    
    // Interpolate position along the sloped line
    const linkX = x1 + (x2 - x1) * t;
    const linkY = y1 + (y2 - y1) * t;
    
    ctx.beginPath();
    ctx.arc(linkX, linkY, 0.75, 0, Math.PI * 2);
    ctx.fill();
  }
}
