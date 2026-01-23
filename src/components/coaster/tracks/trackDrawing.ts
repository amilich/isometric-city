/**
 * Coaster Track Drawing System
 * Draws roller coaster tracks using canvas geometry (not sprites)
 * Inspired by the rail system but with 3D height support
 */

import type { StrutStyle, CoasterCategory } from '@/games/coaster/types/tracks';

// =============================================================================
// CONSTANTS
// =============================================================================

const TILE_WIDTH = 64;
const HEIGHT_RATIO = 0.60;
const TILE_HEIGHT = TILE_WIDTH * HEIGHT_RATIO;

// Track visual parameters  
const TRACK_WIDTH = 14; // Width between the two rails (spacing)
const RAIL_WIDTH = 6; // Width of individual rails (3px radius)
const TIE_LENGTH = 18; // Length of crossties
const TIE_WIDTH = 3; // Width of crossties
const TIE_SPACING = 8; // Space between crossties
const SUPPORT_WIDTH = 2; // Width of support columns (thinner)

// Height unit in pixels (for vertical track elements)
const HEIGHT_UNIT = 20;

// Colors
const COLORS = {
  rail: '#4b5563', // Gray steel
  railHighlight: '#6b7280',
  tie: '#2d3748', // Dark steel gray
  support: '#374151', // Dark gray
  supportHighlight: '#4b5563',
  // Wood strut colors (warm brown tones)
  woodMain: '#8B4513', // Saddle brown - main beams
  woodDark: '#5D3A1A', // Dark brown - shadows/outlines
  woodLight: '#A0522D', // Sienna - highlights
  woodAccent: '#654321', // Dark wood for cross beams
  // Metal strut colors (industrial steel)
  metalMain: '#4A5568', // Cool gray steel
  metalDark: '#2D3748', // Dark steel
  metalLight: '#718096', // Light steel highlight
  metalRivet: '#1A202C', // Near black for rivets/details
  // Concrete foundation colors (matching path style)
  concreteTop: '#9ca3af',    // Light gray top face
  concreteLeft: '#6b7280',   // Medium gray left face (shadow)
  concreteRight: '#78838f',  // Slightly lighter right face
  concreteEdge: '#52525b',   // Dark edge/outline
  // Water coaster colors
  waterLight: '#60c3eb',     // Light blue water surface
  waterMedium: '#3ba7d9',    // Medium blue water
  waterDark: '#2980b9',      // Darker blue for depth
  waterFoam: '#e0f4fc',      // White foam/spray
  waterShadow: '#1a5276',    // Deep shadow under water
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
// SPECIAL EFFECTS FOR COASTER CATEGORIES
// =============================================================================

/**
 * Draw animated water channel around track for water coasters
 * Creates a trough of water that the boat rides through
 */
function drawWaterChannel(
  ctx: CanvasRenderingContext2D,
  fromEdge: { x: number; y: number },
  toEdge: { x: number; y: number },
  perpX: number,
  perpY: number,
  tick: number = 0
) {
  const channelWidth = 14; // Wider than the track
  const waterDepth = 4;
  
  // Animate water with tick
  const waveOffset = (tick % 60) / 60 * Math.PI * 2;
  
  // Draw water channel base (dark shadow underneath)
  ctx.fillStyle = COLORS.waterShadow;
  ctx.beginPath();
  ctx.moveTo(fromEdge.x - perpX * channelWidth / 2, fromEdge.y - perpY * channelWidth / 2 + waterDepth);
  ctx.lineTo(toEdge.x - perpX * channelWidth / 2, toEdge.y - perpY * channelWidth / 2 + waterDepth);
  ctx.lineTo(toEdge.x + perpX * channelWidth / 2, toEdge.y + perpY * channelWidth / 2 + waterDepth);
  ctx.lineTo(fromEdge.x + perpX * channelWidth / 2, fromEdge.y + perpY * channelWidth / 2 + waterDepth);
  ctx.closePath();
  ctx.fill();
  
  // Draw main water surface with gradient
  const gradient = ctx.createLinearGradient(
    fromEdge.x - perpX * channelWidth / 2, fromEdge.y,
    fromEdge.x + perpX * channelWidth / 2, fromEdge.y
  );
  gradient.addColorStop(0, COLORS.waterDark);
  gradient.addColorStop(0.3, COLORS.waterMedium);
  gradient.addColorStop(0.5, COLORS.waterLight);
  gradient.addColorStop(0.7, COLORS.waterMedium);
  gradient.addColorStop(1, COLORS.waterDark);
  
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(fromEdge.x - perpX * channelWidth / 2, fromEdge.y - perpY * channelWidth / 2);
  ctx.lineTo(toEdge.x - perpX * channelWidth / 2, toEdge.y - perpY * channelWidth / 2);
  ctx.lineTo(toEdge.x + perpX * channelWidth / 2, toEdge.y + perpY * channelWidth / 2);
  ctx.lineTo(fromEdge.x + perpX * channelWidth / 2, fromEdge.y + perpY * channelWidth / 2);
  ctx.closePath();
  ctx.fill();
  
  // Draw animated wave highlights
  const length = Math.hypot(toEdge.x - fromEdge.x, toEdge.y - fromEdge.y);
  const numWaves = Math.floor(length / 10);
  
  ctx.strokeStyle = COLORS.waterFoam;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.6;
  
  for (let i = 0; i < numWaves; i++) {
    const t = (i / numWaves + waveOffset / (Math.PI * 2)) % 1;
    const waveX = fromEdge.x + (toEdge.x - fromEdge.x) * t;
    const waveY = fromEdge.y + (toEdge.y - fromEdge.y) * t;
    const waveAmplitude = Math.sin(waveOffset + i * 0.5) * 0.5 + 0.5;
    
    // Small curved highlight
    ctx.beginPath();
    const waveWidth = 4 * waveAmplitude;
    ctx.moveTo(waveX - perpX * waveWidth, waveY - perpY * waveWidth - 1);
    ctx.quadraticCurveTo(
      waveX, waveY - 2,
      waveX + perpX * waveWidth, waveY + perpY * waveWidth - 1
    );
    ctx.stroke();
  }
  
  ctx.globalAlpha = 1;
  
  // Draw channel edges (walls)
  ctx.strokeStyle = COLORS.waterDark;
  ctx.lineWidth = 2;
  
  // Left edge
  ctx.beginPath();
  ctx.moveTo(fromEdge.x - perpX * channelWidth / 2, fromEdge.y - perpY * channelWidth / 2);
  ctx.lineTo(toEdge.x - perpX * channelWidth / 2, toEdge.y - perpY * channelWidth / 2);
  ctx.stroke();
  
  // Right edge
  ctx.beginPath();
  ctx.moveTo(fromEdge.x + perpX * channelWidth / 2, fromEdge.y + perpY * channelWidth / 2);
  ctx.lineTo(toEdge.x + perpX * channelWidth / 2, toEdge.y + perpY * channelWidth / 2);
  ctx.stroke();
}

/**
 * Draw enhanced wooden cross-bracing for wooden coasters
 * Creates the classic lattice structure of wooden coaster supports
 */
function drawWoodenCrossBracing(
  ctx: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  height: number,
  perpX: number = 0,
  perpY: number = 0
) {
  if (height <= 0) return;
  
  const heightPx = height * HEIGHT_UNIT;
  const baseWidth = 16 + height * 2; // Wider at base for taller structures
  const topWidth = 8;
  
  // Draw from ground up
  const topY = groundY - heightPx;
  
  // Main vertical posts (2 on each side)
  const postSpacing = baseWidth * 0.4;
  
  ctx.strokeStyle = COLORS.woodDark;
  ctx.lineWidth = 3;
  
  // Left posts
  ctx.beginPath();
  ctx.moveTo(x - baseWidth / 2, groundY);
  ctx.lineTo(x - topWidth / 2, topY);
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo(x - baseWidth / 2 + postSpacing, groundY);
  ctx.lineTo(x - topWidth / 2 + postSpacing * 0.3, topY);
  ctx.stroke();
  
  // Right posts
  ctx.beginPath();
  ctx.moveTo(x + baseWidth / 2, groundY);
  ctx.lineTo(x + topWidth / 2, topY);
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo(x + baseWidth / 2 - postSpacing, groundY);
  ctx.lineTo(x + topWidth / 2 - postSpacing * 0.3, topY);
  ctx.stroke();
  
  // Cross braces (X pattern)
  const numBraces = Math.max(2, Math.floor(height * 1.5));
  ctx.strokeStyle = COLORS.woodAccent;
  ctx.lineWidth = 2;
  
  for (let i = 0; i < numBraces; i++) {
    const t1 = i / numBraces;
    const t2 = (i + 1) / numBraces;
    
    const y1 = groundY - heightPx * t1;
    const y2 = groundY - heightPx * t2;
    
    // Width at each height (tapers from base to top)
    const w1 = baseWidth - (baseWidth - topWidth) * t1;
    const w2 = baseWidth - (baseWidth - topWidth) * t2;
    
    // X brace pattern
    // Left side X
    ctx.beginPath();
    ctx.moveTo(x - w1 / 2, y1);
    ctx.lineTo(x - w2 / 2 + (w2 * 0.3), y2);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(x - w1 / 2 + (w1 * 0.3), y1);
    ctx.lineTo(x - w2 / 2, y2);
    ctx.stroke();
    
    // Right side X
    ctx.beginPath();
    ctx.moveTo(x + w1 / 2, y1);
    ctx.lineTo(x + w2 / 2 - (w2 * 0.3), y2);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(x + w1 / 2 - (w1 * 0.3), y1);
    ctx.lineTo(x + w2 / 2, y2);
    ctx.stroke();
    
    // Horizontal brace
    ctx.strokeStyle = COLORS.woodMain;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x - w2 / 2, y2);
    ctx.lineTo(x + w2 / 2, y2);
    ctx.stroke();
    ctx.strokeStyle = COLORS.woodAccent;
    ctx.lineWidth = 2;
  }
  
  // Draw highlight on main posts
  ctx.strokeStyle = COLORS.woodLight;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.5;
  
  ctx.beginPath();
  ctx.moveTo(x - baseWidth / 2 + 1, groundY);
  ctx.lineTo(x - topWidth / 2 + 1, topY);
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo(x + baseWidth / 2 - 1, groundY);
  ctx.lineTo(x + topWidth / 2 - 1, topY);
  ctx.stroke();
  
  ctx.globalAlpha = 1;
  
  // Suppress unused parameter warnings
  void perpX;
  void perpY;
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
  trackColor: string = COLORS.rail,
  strutStyle: StrutStyle = 'metal',
  coasterCategory?: CoasterCategory,
  tick: number = 0
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
  
  // Draw water channel FIRST (behind everything) for water coasters
  if (coasterCategory === 'water') {
    drawWaterChannel(ctx, fromEdge, toEdge, perpX, perpY, tick);
  }
  
  // Draw support column if elevated
  if (height > 0) {
    // Use enhanced wooden cross-bracing for wooden coasters
    if (coasterCategory === 'wooden' || strutStyle === 'wood') {
      drawWoodenCrossBracing(ctx, center.x, center.y + heightOffset, height, perpX, perpY);
    } else {
      drawSupport(ctx, center.x, center.y + heightOffset, height, { x: perpX, y: perpY }, strutStyle);
    }
  }
  
  // Calculate track length for tie spacing
  const length = Math.hypot(toEdge.x - fromEdge.x, toEdge.y - fromEdge.y);
  const numTies = Math.max(3, Math.floor(length / TIE_SPACING));
  
  // Draw crossties using filled rectangles instead of strokes
  const tieColor = (coasterCategory === 'wooden' || strutStyle === 'wood') ? COLORS.woodAccent : COLORS.tie;
  const tieWidth = TIE_WIDTH;
  
  for (let i = 0; i <= numTies; i++) {
    const t = i / numTies;
    const tieX = fromEdge.x + (toEdge.x - fromEdge.x) * t;
    const tieY = fromEdge.y + (toEdge.y - fromEdge.y) * t;
    
    // Draw tie as a filled polygon
    const halfLen = TIE_LENGTH / 2;
    const halfWidth = tieWidth / 2;
    
    // Calculate the 4 corners of the tie rectangle
    // Tie runs perpendicular to the track (along perpX, perpY)
    // Track direction is from fromEdge to toEdge
    const trackDirX = (toEdge.x - fromEdge.x) / length;
    const trackDirY = (toEdge.y - fromEdge.y) / length;
    
    ctx.fillStyle = tieColor;
    ctx.beginPath();
    ctx.moveTo(
      tieX - perpX * halfLen - trackDirX * halfWidth,
      tieY - perpY * halfLen - trackDirY * halfWidth
    );
    ctx.lineTo(
      tieX + perpX * halfLen - trackDirX * halfWidth,
      tieY + perpY * halfLen - trackDirY * halfWidth
    );
    ctx.lineTo(
      tieX + perpX * halfLen + trackDirX * halfWidth,
      tieY + perpY * halfLen + trackDirY * halfWidth
    );
    ctx.lineTo(
      tieX - perpX * halfLen + trackDirX * halfWidth,
      tieY - perpY * halfLen + trackDirY * halfWidth
    );
    ctx.closePath();
    ctx.fill();
  }
  
  // Draw rails using filled circles for a smooth line appearance
  const railOffset = TRACK_WIDTH / 2;
  const effectiveColor = trackColor || COLORS.rail;
  const railRadius = RAIL_WIDTH / 2;
  const numRailPoints = Math.max(10, Math.ceil(length / 3)); // More points for longer tracks
  
  // Left rail
  for (let i = 0; i <= numRailPoints; i++) {
    const t = i / numRailPoints;
    const x = fromEdge.x - perpX * railOffset + (toEdge.x - fromEdge.x) * t;
    const y = fromEdge.y - perpY * railOffset + (toEdge.y - fromEdge.y) * t;
    ctx.fillStyle = effectiveColor;
    ctx.beginPath();
    ctx.arc(x, y, railRadius, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Right rail
  for (let i = 0; i <= numRailPoints; i++) {
    const t = i / numRailPoints;
    const x = fromEdge.x + perpX * railOffset + (toEdge.x - fromEdge.x) * t;
    const y = fromEdge.y + perpY * railOffset + (toEdge.y - fromEdge.y) * t;
    ctx.fillStyle = effectiveColor;
    ctx.beginPath();
    ctx.arc(x, y, railRadius, 0, Math.PI * 2);
    ctx.fill();
  }
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
  trackColor: string = COLORS.rail,
  strutStyle: StrutStyle = 'metal',
  coasterCategory?: CoasterCategory,
  _tick: number = 0
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
    // Use enhanced wooden cross-bracing for wooden coasters
    if (coasterCategory === 'wooden' || strutStyle === 'wood') {
      drawWoodenCrossBracing(ctx, curveMid.x, curveMid.y + heightOffset, height, 0, 0);
    } else {
      drawSupport(ctx, curveMid.x, curveMid.y + heightOffset, height, undefined, strutStyle);
    }
  }
  
  // Draw crossties along the quadratic curve (fewer ties - 4 is enough)
  const numTies = 4;
  const tieColor = (coasterCategory === 'wooden' || strutStyle === 'wood') ? COLORS.woodAccent : COLORS.tie;
  const tieWidth = TIE_WIDTH;
  
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
    
    // Draw tie as filled polygon
    const halfLen = TIE_LENGTH / 2;
    const halfWidth = tieWidth / 2;
    const tangentNormX = tangent.x / len;
    const tangentNormY = tangent.y / len;
    
    ctx.fillStyle = tieColor;
    ctx.beginPath();
    ctx.moveTo(
      pt.x - perpX * halfLen - tangentNormX * halfWidth,
      pt.y - perpY * halfLen - tangentNormY * halfWidth
    );
    ctx.lineTo(
      pt.x + perpX * halfLen - tangentNormX * halfWidth,
      pt.y + perpY * halfLen - tangentNormY * halfWidth
    );
    ctx.lineTo(
      pt.x + perpX * halfLen + tangentNormX * halfWidth,
      pt.y + perpY * halfLen + tangentNormY * halfWidth
    );
    ctx.lineTo(
      pt.x - perpX * halfLen + tangentNormX * halfWidth,
      pt.y - perpY * halfLen + tangentNormY * halfWidth
    );
    ctx.closePath();
    ctx.fill();
  }
  
  // Draw rails using filled circles along the quadratic bezier
  const railOffset = TRACK_WIDTH / 2;
  const effectiveColor = trackColor || COLORS.rail;
  const railRadius = RAIL_WIDTH / 2;
  const numRailPoints = 16;
  
  // Left and right rail paths
  for (const side of [-1, 1]) {
    for (let i = 0; i <= numRailPoints; i++) {
      const t = i / numRailPoints;
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
      
      ctx.fillStyle = effectiveColor;
      ctx.beginPath();
      ctx.arc(rx, ry, railRadius, 0, Math.PI * 2);
      ctx.fill();
    }
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
  trackColor: string = COLORS.rail,
  strutStyle: StrutStyle = 'metal',
  coasterCategory?: CoasterCategory,
  _tick: number = 0
) {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  
  // Use edge midpoints like straight track for proper alignment
  const northEdge = { x: startX + w * 0.25, y: startY + h * 0.25 };
  const eastEdge = { x: startX + w * 0.75, y: startY + h * 0.25 };
  const southEdge = { x: startX + w * 0.75, y: startY + h * 0.75 };
  const westEdge = { x: startX + w * 0.25, y: startY + h * 0.75 };
  const center = { x: startX + w / 2, y: startY + h / 2 };
  void center; // Unused but kept for symmetry
  
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
  
  // Calculate actual track direction vector (including slope)
  const trackDirX = x2 - x1;
  const trackDirY = y2 - y1;
  const trackLen = Math.hypot(trackDirX, trackDirY);
  
  // Use ground-plane perpendicular for ties (same as rails)
  // This keeps ties aligned with the isometric grid, perpendicular to ground direction
  const perpX = groundPerpX;
  const perpY = groundPerpY;
  
  // Draw supports at start and end if elevated
  if (fromHeight > 0) {
    if (coasterCategory === 'wooden' || strutStyle === 'wood') {
      drawWoodenCrossBracing(ctx, x1, fromEdge.y, fromHeight, perpX, perpY);
    } else {
      drawSupport(ctx, x1, fromEdge.y, fromHeight, { x: perpX, y: perpY }, strutStyle);
    }
  }
  if (toHeight > 0) {
    if (coasterCategory === 'wooden' || strutStyle === 'wood') {
      drawWoodenCrossBracing(ctx, x2, toEdge.y, toHeight, perpX, perpY);
    } else {
      drawSupport(ctx, x2, toEdge.y, toHeight, { x: perpX, y: perpY }, strutStyle);
    }
  }
  
  // Draw crossties using fill-based drawing (stroke doesn't work in this canvas context)
  const numTies = Math.max(3, Math.floor(trackLen / TIE_SPACING));
  
  // Wooden coasters get wooden ties
  const tieColor = (coasterCategory === 'wooden' || strutStyle === 'wood') ? COLORS.woodAccent : COLORS.tie;
  const tieWidth = TIE_WIDTH;
  
  for (let i = 0; i <= numTies; i++) {
    const t = i / numTies;
    const tieX = x1 + trackDirX * t;
    const tieY = y1 + trackDirY * t;
    
    // Draw tie as a filled polygon (rectangle along the perpendicular)
    const halfLen = TIE_LENGTH / 2;
    const halfWidth = tieWidth / 2;
    
    // Get the normalized track direction for the tie width offset
    const normTrackX = trackLen > 0 ? trackDirX / trackLen : 0;
    const normTrackY = trackLen > 0 ? trackDirY / trackLen : 0;
    
    // Four corners of the tie rectangle
    const x1t = tieX - perpX * halfLen - normTrackX * halfWidth;
    const y1t = tieY - perpY * halfLen - normTrackY * halfWidth;
    const x2t = tieX + perpX * halfLen - normTrackX * halfWidth;
    const y2t = tieY + perpY * halfLen - normTrackY * halfWidth;
    const x3t = tieX + perpX * halfLen + normTrackX * halfWidth;
    const y3t = tieY + perpY * halfLen + normTrackY * halfWidth;
    const x4t = tieX - perpX * halfLen + normTrackX * halfWidth;
    const y4t = tieY - perpY * halfLen + normTrackY * halfWidth;
    
    ctx.fillStyle = tieColor;
    ctx.beginPath();
    ctx.moveTo(x1t, y1t);
    ctx.lineTo(x2t, y2t);
    ctx.lineTo(x3t, y3t);
    ctx.lineTo(x4t, y4t);
    ctx.closePath();
    ctx.fill();
  }
  
  // Draw rails using fill-based drawing (series of small filled circles)
  const railOffset = TRACK_WIDTH / 2;
  const railCircleRadius = RAIL_WIDTH / 2;
  const railSteps = Math.max(10, Math.floor(trackLen / 2));
  
  ctx.fillStyle = trackColor;
  
  for (let i = 0; i <= railSteps; i++) {
    const t = i / railSteps;
    const rx = x1 + trackDirX * t;
    const ry = y1 + trackDirY * t;
    
    // Left rail
    ctx.beginPath();
    ctx.arc(rx - groundPerpX * railOffset, ry - groundPerpY * railOffset, railCircleRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // Right rail
    ctx.beginPath();
    ctx.arc(rx + groundPerpX * railOffset, ry + groundPerpY * railOffset, railCircleRadius, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Draw an isometric concrete foundation block
 * Creates a 3D block with top, left, and right faces for a solid foundation look
 */
function drawConcreteFoundation(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  blockWidth: number = 8,
  blockDepth: number = 6,
  blockHeight: number = 3
) {
  // Isometric projection - use standard isometric angles
  // Width goes along NE-SW axis, depth goes along NW-SE axis
  const halfW = blockWidth * 0.5;
  const halfD = blockDepth * 0.5;
  
  // Isometric projection: x offset = (w - d) * 0.5, y offset = (w + d) * 0.25
  // The block sits ABOVE ground level (column lands on top of it)
  // z=0 is ground level, z=blockHeight is top of foundation
  const toIso = (localX: number, localY: number, localZ: number) => ({
    x: x + (localX - localY) * 0.5,
    y: y + (localX + localY) * 0.25 - localZ  // - localZ so block rises above ground
  });
  
  // Define the 8 corners of the box in local coordinates
  // Bottom face (z = 0, at ground level)
  const b_nw = toIso(-halfW, -halfD, 0);  // back-left
  const b_ne = toIso(halfW, -halfD, 0);   // back-right  
  const b_se = toIso(halfW, halfD, 0);    // front-right
  const b_sw = toIso(-halfW, halfD, 0);   // front-left
  
  // Top face (z = blockHeight, where column lands)
  const t_nw = toIso(-halfW, -halfD, blockHeight);
  const t_ne = toIso(halfW, -halfD, blockHeight);
  const t_se = toIso(halfW, halfD, blockHeight);
  const t_sw = toIso(-halfW, halfD, blockHeight);
  
  // Draw left face (SW side - darker shadow)
  ctx.fillStyle = COLORS.concreteLeft;
  ctx.beginPath();
  ctx.moveTo(t_sw.x, t_sw.y);
  ctx.lineTo(t_nw.x, t_nw.y);
  ctx.lineTo(b_nw.x, b_nw.y);
  ctx.lineTo(b_sw.x, b_sw.y);
  ctx.closePath();
  ctx.fill();
  
  // Draw right face (SE side - medium gray)
  ctx.fillStyle = COLORS.concreteRight;
  ctx.beginPath();
  ctx.moveTo(t_se.x, t_se.y);
  ctx.lineTo(t_sw.x, t_sw.y);
  ctx.lineTo(b_sw.x, b_sw.y);
  ctx.lineTo(b_se.x, b_se.y);
  ctx.closePath();
  ctx.fill();
  
  // Draw top face (lightest)
  ctx.fillStyle = COLORS.concreteTop;
  ctx.beginPath();
  ctx.moveTo(t_nw.x, t_nw.y);
  ctx.lineTo(t_ne.x, t_ne.y);
  ctx.lineTo(t_se.x, t_se.y);
  ctx.lineTo(t_sw.x, t_sw.y);
  ctx.closePath();
  ctx.fill();
  
  // Draw edges for definition
  ctx.strokeStyle = COLORS.concreteEdge;
  ctx.lineWidth = 0.5;
  
  // Top face outline
  ctx.beginPath();
  ctx.moveTo(t_nw.x, t_nw.y);
  ctx.lineTo(t_ne.x, t_ne.y);
  ctx.lineTo(t_se.x, t_se.y);
  ctx.lineTo(t_sw.x, t_sw.y);
  ctx.closePath();
  ctx.stroke();
  
  // Visible vertical edges (front corner)
  ctx.beginPath();
  ctx.moveTo(t_sw.x, t_sw.y);
  ctx.lineTo(b_sw.x, b_sw.y);
  ctx.stroke();
}

/**
 * Draw a wooden support structure - dense timber frame with X-cross bracing
 * Classic wooden coaster aesthetic with lots of beams and crosses
 */
function drawWoodSupport(
  ctx: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  height: number,
  perp?: { x: number; y: number }
) {
  if (height <= 0) return;
  
  // Wooden supports are wider and more substantial
  const columnSpacing = 6; // Wider spacing for wood frame
  const perpX = perp?.x ?? 1;
  const perpY = perp?.y ?? 0;
  const offsetX = perpX * columnSpacing;
  const offsetY = perpY * columnSpacing;
  
  const supportHeight = height * HEIGHT_UNIT;
  const woodWidth = 3; // Thicker beams for wood
  
  // Calculate column positions
  const leftBaseX = x - offsetX;
  const leftBaseY = groundY - offsetY;
  const leftTopY = leftBaseY - supportHeight;
  
  const rightBaseX = x + offsetX;
  const rightBaseY = groundY + offsetY;
  const rightTopY = rightBaseY - supportHeight;
  
  // Draw concrete foundations FIRST (behind the columns)
  const foundationWidth = 10;
  const foundationDepth = 8;
  const foundationHeight = 4;
  drawConcreteFoundation(ctx, leftBaseX, leftBaseY, foundationWidth, foundationDepth, foundationHeight);
  drawConcreteFoundation(ctx, rightBaseX, rightBaseY, foundationWidth, foundationDepth, foundationHeight);
  
  // Draw main vertical beams (with slight inward lean for stability look)
  const leanFactor = 0.15; // Beams lean inward slightly at top
  const leftTopX = leftBaseX + offsetX * leanFactor;
  const rightTopX = rightBaseX - offsetX * leanFactor;
  const leftTopYOffset = leftTopY + offsetY * leanFactor;
  const rightTopYOffset = rightTopY - offsetY * leanFactor;
  
  // Main vertical beams
  ctx.strokeStyle = COLORS.woodMain;
  ctx.lineWidth = woodWidth;
  ctx.lineCap = 'square';
  
  // Left main beam
  ctx.beginPath();
  ctx.moveTo(leftBaseX, leftBaseY);
  ctx.lineTo(leftTopX, leftTopYOffset);
  ctx.stroke();
  
  // Right main beam
  ctx.beginPath();
  ctx.moveTo(rightBaseX, rightBaseY);
  ctx.lineTo(rightTopX, rightTopYOffset);
  ctx.stroke();
  
  // Calculate number of cross-brace sections (dense for wood)
  // More sections for taller supports
  const numSections = Math.max(2, Math.ceil(height * 1.5));
  const sectionHeight = supportHeight / numSections;
  
  // Draw horizontal ledgers and X-braces for each section
  for (let i = 0; i < numSections; i++) {
    const t1 = i / numSections;
    const t2 = (i + 1) / numSections;
    
    // Interpolate positions for this section
    const topLeftX = leftBaseX + (leftTopX - leftBaseX) * t2;
    const topLeftY = leftBaseY + (leftTopYOffset - leftBaseY) * t2;
    const bottomLeftX = leftBaseX + (leftTopX - leftBaseX) * t1;
    const bottomLeftY = leftBaseY + (leftTopYOffset - leftBaseY) * t1;
    
    const topRightX = rightBaseX + (rightTopX - rightBaseX) * t2;
    const topRightY = rightBaseY + (rightTopYOffset - rightBaseY) * t2;
    const bottomRightX = rightBaseX + (rightTopX - rightBaseX) * t1;
    const bottomRightY = rightBaseY + (rightTopYOffset - rightBaseY) * t1;
    
    // Draw horizontal ledger at bottom of section (except for ground level)
    if (i > 0) {
      ctx.strokeStyle = COLORS.woodAccent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(bottomLeftX, bottomLeftY);
      ctx.lineTo(bottomRightX, bottomRightY);
      ctx.stroke();
    }
    
    // Draw X-brace (two diagonal beams crossing)
    ctx.strokeStyle = COLORS.woodAccent;
    ctx.lineWidth = 1.5;
    
    // First diagonal: bottom-left to top-right
    ctx.beginPath();
    ctx.moveTo(bottomLeftX, bottomLeftY);
    ctx.lineTo(topRightX, topRightY);
    ctx.stroke();
    
    // Second diagonal: bottom-right to top-left
    ctx.beginPath();
    ctx.moveTo(bottomRightX, bottomRightY);
    ctx.lineTo(topLeftX, topLeftY);
    ctx.stroke();
  }
  
  // Draw top horizontal beam (connects both columns at track level)
  ctx.strokeStyle = COLORS.woodMain;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(leftTopX, leftTopYOffset);
  ctx.lineTo(rightTopX, rightTopYOffset);
  ctx.stroke();
}

/**
 * Draw a metal support structure - clean industrial steel with minimal bracing
 * Modern steel coaster aesthetic with I-beam columns and simple connections
 */
function drawMetalSupport(
  ctx: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  height: number,
  perp?: { x: number; y: number }
) {
  if (height <= 0) return;
  
  // Metal supports are sleeker
  const columnSpacing = 5;
  const perpX = perp?.x ?? 1;
  const perpY = perp?.y ?? 0;
  const offsetX = perpX * columnSpacing;
  const offsetY = perpY * columnSpacing;
  
  const supportHeight = height * HEIGHT_UNIT;
  const beamWidth = 2.5;
  
  // Calculate column positions
  const leftBaseX = x - offsetX;
  const leftBaseY = groundY - offsetY;
  const leftTopY = leftBaseY - supportHeight;
  
  const rightBaseX = x + offsetX;
  const rightBaseY = groundY + offsetY;
  const rightTopY = rightBaseY - supportHeight;
  
  // Draw concrete foundations FIRST (behind the columns)
  const foundationWidth = 9;
  const foundationDepth = 7;
  const foundationHeight = 4;
  drawConcreteFoundation(ctx, leftBaseX, leftBaseY, foundationWidth, foundationDepth, foundationHeight);
  drawConcreteFoundation(ctx, rightBaseX, rightBaseY, foundationWidth, foundationDepth, foundationHeight);
  
  // Main vertical I-beam columns
  ctx.strokeStyle = COLORS.metalMain;
  ctx.lineWidth = beamWidth;
  ctx.lineCap = 'butt';
  
  // Left column
  ctx.beginPath();
  ctx.moveTo(leftBaseX, leftBaseY);
  ctx.lineTo(leftBaseX, leftTopY);
  ctx.stroke();
  
  // Right column
  ctx.beginPath();
  ctx.moveTo(rightBaseX, rightBaseY);
  ctx.lineTo(rightBaseX, rightTopY);
  ctx.stroke();
  
  // Horizontal braces - fewer than wood, cleaner look
  const numBraces = Math.max(1, Math.floor(height / 1.5));
  
  for (let i = 1; i <= numBraces; i++) {
    const t = i / (numBraces + 1);
    const leftBraceY = leftTopY + (leftBaseY - leftTopY) * t;
    const rightBraceY = rightTopY + (rightBaseY - rightTopY) * t;
    
    // Draw horizontal brace
    ctx.strokeStyle = COLORS.metalMain;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(leftBaseX, leftBraceY);
    ctx.lineTo(rightBaseX, rightBraceY);
    ctx.stroke();
    
    // Add small diagonal braces between horizontal levels (K-bracing style)
    if (i < numBraces) {
      const nextT = (i + 1) / (numBraces + 1);
      const nextLeftBraceY = leftTopY + (leftBaseY - leftTopY) * nextT;
      const nextRightBraceY = rightTopY + (rightBaseY - rightTopY) * nextT;
      
      // Mid-point for K-brace
      const midX = (leftBaseX + rightBaseX) / 2;
      const midY = (leftBraceY + rightBraceY) / 2;
      const nextMidY = (nextLeftBraceY + nextRightBraceY) / 2;
      
      ctx.strokeStyle = COLORS.metalMain;
      ctx.lineWidth = 1;
      
      // Diagonal from mid to corners
      ctx.beginPath();
      ctx.moveTo(midX, midY);
      ctx.lineTo(leftBaseX, nextLeftBraceY);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(midX, midY);
      ctx.lineTo(rightBaseX, nextRightBraceY);
      ctx.stroke();
    }
  }
  
  // Top beam connecting columns
  ctx.strokeStyle = COLORS.metalMain;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(leftBaseX, leftTopY);
  ctx.lineTo(rightBaseX, rightTopY);
  ctx.stroke();
  
  // Draw rivets/bolts at connection points
  ctx.fillStyle = COLORS.metalRivet;
  const rivetSize = 1;
  
  // Rivets at top connections
  ctx.beginPath();
  ctx.arc(leftBaseX, leftTopY, rivetSize, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(rightBaseX, rightTopY, rivetSize, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Draw a support column - dispatches to wood or metal style
 */
function drawSupport(
  ctx: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  height: number,
  perp?: { x: number; y: number },
  strutStyle: StrutStyle = 'metal'
) {
  if (strutStyle === 'wood') {
    drawWoodSupport(ctx, x, groundY, height, perp);
  } else {
    drawMetalSupport(ctx, x, groundY, height, perp);
  }
}

/**
 * Draw a vertical loop section
 * The loop connects entry edge to exit edge while going up, over (inverted), and down.
 * Train moves forward while completing the loop - like RCT style stretched loops.
 */
export function drawLoopTrack(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  direction: TrackDirection,
  loopHeight: number,
  trackColor: string = COLORS.rail,
  strutStyle: StrutStyle = 'metal',
  coasterCategory?: CoasterCategory,
  _tick: number = 0,
  baseHeight: number = 0  // Height of track above ground (for support calculation)
) {
  void coasterCategory; // Category can be used for future loop styling
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  
  // Edge midpoints - MUST match straight track endpoints for proper connections
  const northEdge = { x: startX + w * 0.25, y: startY + h * 0.25 };
  const eastEdge = { x: startX + w * 0.75, y: startY + h * 0.25 };
  const southEdge = { x: startX + w * 0.75, y: startY + h * 0.75 };
  const westEdge = { x: startX + w * 0.25, y: startY + h * 0.75 };
  const tileCenter = { x: startX + w / 2, y: startY + h / 2 };
  
  // Determine entry and exit edges based on direction
  let entryEdge: Point;
  let exitEdge: Point;
  
  if (direction === 'south') {
    entryEdge = northEdge;
    exitEdge = southEdge;
  } else if (direction === 'north') {
    entryEdge = southEdge;
    exitEdge = northEdge;
  } else if (direction === 'east') {
    entryEdge = westEdge;
    exitEdge = eastEdge;
  } else { // west
    entryEdge = eastEdge;
    exitEdge = westEdge;
  }
  
  // Loop parameters - fixed size regardless of track height
  const loopRadius = 30;
  const numSegments = 32;
  const railOffset = TRACK_WIDTH / 2;
  
  // Perpendicular direction (for rail offset)
  const trackDx = exitEdge.x - entryEdge.x;
  const trackDy = exitEdge.y - entryEdge.y;
  const trackLen = Math.hypot(trackDx, trackDy);
  const perpX = -trackDy / trackLen;
  const perpY = trackDx / trackLen;
  
  /**
   * Get point on the loop at parameter t (0 to 1)
   * t=0: entry edge, t=0.5: top of loop (inverted), t=1: exit edge
   * The train moves forward while looping - a "stretched" vertical loop
   */
  const getLoopPoint = (t: number, railSide: number = 0): Point => {
    // Forward progress: linear from entry to exit
    const forwardX = entryEdge.x + t * (exitEdge.x - entryEdge.x);
    const forwardY = entryEdge.y + t * (exitEdge.y - entryEdge.y);
    
    // Loop angle: full rotation (0 to 2π)
    const angle = t * Math.PI * 2;
    
    // Height: (1 - cos(angle)) gives 0 at entry/exit, 2*radius at top
    const heightOffset = (1 - Math.cos(angle)) * loopRadius;
    
    // Horizontal "bulge" to make it circular - larger value = more circular loop
    // sin(angle) gives outward bulge in first half, inward in second half
    const bulgeFactor = 0.9; // How much the loop bulges outward (0.9 = nearly circular)
    const bulgeOffset = Math.sin(angle) * loopRadius * bulgeFactor;
    
    // Apply bulge along track direction (makes loop visible from side)
    const bulgeX = (trackDx / trackLen) * bulgeOffset;
    const bulgeY = (trackDy / trackLen) * bulgeOffset;
    
    return {
      x: forwardX + bulgeX + perpX * railOffset * railSide,
      y: forwardY + bulgeY - heightOffset + perpY * railOffset * railSide
    };
  };
  
  // Draw support structure first (behind the loop)
  const isWood = strutStyle === 'wood';
  const mainColor = isWood ? COLORS.woodMain : COLORS.metalMain;
  const darkColor = isWood ? COLORS.woodDark : COLORS.metalDark;
  const lightColor = isWood ? COLORS.woodLight : COLORS.metalLight;
  const accentColor = isWood ? COLORS.woodAccent : COLORS.metalMain;
  
  // Support extends from actual ground level up past the loop top
  // startY is already adjusted for elevation, so we need to add back the baseHeight offset
  // to find the true ground level
  const groundY = startY + h + baseHeight * HEIGHT_UNIT; // Actual ground level
  const supportTopY = tileCenter.y - loopRadius * 2 - 3;
  const supportHeight = groundY - supportTopY;
  const supportWidth = isWood ? 5 : 4;
  
  // Draw concrete foundation FIRST (behind the support column)
  const loopFoundationWidth = 12;
  const loopFoundationDepth = 10;
  const loopFoundationHeight = 5;
  drawConcreteFoundation(ctx, tileCenter.x, groundY, loopFoundationWidth, loopFoundationDepth, loopFoundationHeight);
  
  // Draw main support column at tile center
  ctx.fillStyle = mainColor;
  ctx.beginPath();
  ctx.moveTo(tileCenter.x - supportWidth / 2, groundY);
  ctx.lineTo(tileCenter.x - supportWidth / 2, supportTopY);
  ctx.lineTo(tileCenter.x + supportWidth / 2, supportTopY);
  ctx.lineTo(tileCenter.x + supportWidth / 2, groundY);
  ctx.closePath();
  ctx.fill();
  
  // Horizontal braces
  const numBraces = isWood ? 5 : 3;
  for (let i = 1; i <= numBraces; i++) {
    const t = i / (numBraces + 1);
    const braceY = groundY - supportHeight * t;
    const braceWidth = loopRadius * (isWood ? 0.5 : 0.4) * (1 - t * 0.3);
    
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = isWood ? 2 : 1.5;
    ctx.beginPath();
    ctx.moveTo(tileCenter.x - braceWidth, braceY);
    ctx.lineTo(tileCenter.x + braceWidth, braceY);
    ctx.stroke();
    
    if (isWood && i < numBraces) {
      const nextT = (i + 1) / (numBraces + 1);
      const nextBraceY = groundY - supportHeight * nextT;
      const nextBraceWidth = loopRadius * 0.5 * (1 - nextT * 0.3);
      ctx.strokeStyle = COLORS.woodAccent;
      ctx.lineWidth = 1.5;
      
      ctx.beginPath();
      ctx.moveTo(tileCenter.x - braceWidth, braceY);
      ctx.lineTo(tileCenter.x - supportWidth / 2, nextBraceY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(tileCenter.x + braceWidth, braceY);
      ctx.lineTo(tileCenter.x + supportWidth / 2, nextBraceY);
      ctx.stroke();
    }
  }
  
  // Draw crossties around the loop
  ctx.strokeStyle = COLORS.tie;
  ctx.lineWidth = 1;
  
  for (let i = 0; i < numSegments; i += 2) {
    const t = i / numSegments;
    const pt = getLoopPoint(t);
    
    const nextT = (i + 1) / numSegments;
    const nextPt = getLoopPoint(nextT);
    const tangentX = nextPt.x - pt.x;
    const tangentY = nextPt.y - pt.y;
    const tangentLen = Math.hypot(tangentX, tangentY);
    
    if (tangentLen > 0.001) {
      const tieX = -tangentY / tangentLen;
      const tieY = tangentX / tangentLen;
      
      ctx.beginPath();
      ctx.moveTo(pt.x - tieX * TIE_LENGTH * 0.4, pt.y - tieY * TIE_LENGTH * 0.4);
      ctx.lineTo(pt.x + tieX * TIE_LENGTH * 0.4, pt.y + tieY * TIE_LENGTH * 0.4);
      ctx.stroke();
    }
  }
  
  // Draw the two rails
  ctx.strokeStyle = trackColor;
  ctx.lineWidth = RAIL_WIDTH;
  ctx.lineCap = 'round';
  
  for (const railSide of [-1, 1]) {
    ctx.beginPath();
    
    for (let i = 0; i <= numSegments; i++) {
      const t = i / numSegments;
      const pt = getLoopPoint(t, railSide);
      
      if (i === 0) {
        ctx.moveTo(pt.x, pt.y);
      } else {
        ctx.lineTo(pt.x, pt.y);
      }
    }
    
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
