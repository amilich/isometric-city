/**
 * Track Renderer - Draws coaster track pieces on the canvas
 */

import { TrackElement } from '@/games/coaster/types/rides';
import { Ride } from '@/games/coaster/types/rides';
import { TRACK_PIECES, TrackPieceDefinition } from './trackBuilder';
import { TILE_WIDTH, TILE_HEIGHT } from './pathSystem';

// Track colors by coaster type category
export const TRACK_COLORS = {
  default: {
    rail: '#ef4444',      // Red rails
    support: '#6b7280',   // Gray supports
    tie: '#374151',       // Dark ties
    highlight: '#fca5a5', // Light red highlight
  },
  wooden: {
    rail: '#92400e',      // Brown rails
    support: '#78350f',   // Dark brown supports
    tie: '#451a03',       // Very dark ties
    highlight: '#d97706', // Orange highlight
  },
  inverted: {
    rail: '#8b5cf6',      // Purple rails
    support: '#4c1d95',   // Dark purple supports
    tie: '#2e1065',       // Very dark ties
    highlight: '#c4b5fd', // Light purple highlight
  },
  water: {
    rail: '#0ea5e9',      // Blue rails
    support: '#0369a1',   // Dark blue supports
    tie: '#0c4a6e',       // Very dark ties
    highlight: '#7dd3fc', // Light blue highlight
  },
};

/**
 * Convert grid coordinates to screen position
 */
function gridToScreen(
  gridX: number,
  gridY: number,
  height: number,
  offsetX: number,
  offsetY: number,
  zoom: number
): { x: number; y: number } {
  const screenX = (gridX - gridY) * (TILE_WIDTH / 2) * zoom + offsetX;
  const screenY = (gridX + gridY) * (TILE_HEIGHT / 2) * zoom + offsetY - height * 4 * zoom;
  return { x: screenX, y: screenY };
}

/**
 * Draw a track support pillar
 */
function drawSupport(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  height: number,
  zoom: number,
  colors: typeof TRACK_COLORS.default
): void {
  if (height <= 0) return;

  const supportHeight = height * 4 * zoom;
  const supportWidth = 4 * zoom;

  ctx.fillStyle = colors.support;
  
  // Main pillar
  ctx.fillRect(x - supportWidth / 2, y, supportWidth, supportHeight);
  
  // Cross-bracing for tall supports
  if (height > 4) {
    ctx.strokeStyle = colors.support;
    ctx.lineWidth = 1;
    const braceInterval = 8 * zoom;
    for (let i = braceInterval; i < supportHeight; i += braceInterval) {
      ctx.beginPath();
      ctx.moveTo(x - supportWidth, y + i - braceInterval / 2);
      ctx.lineTo(x + supportWidth, y + i);
      ctx.stroke();
    }
  }
}

/**
 * Draw a straight track piece
 */
function drawStraightTrack(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  direction: number,
  zoom: number,
  colors: typeof TRACK_COLORS.default
): void {
  const trackWidth = 20 * zoom;
  const railWidth = 3 * zoom;
  const tieSpacing = 8 * zoom;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((direction * 45 * Math.PI) / 180);

  // Draw ties
  ctx.fillStyle = colors.tie;
  for (let i = -trackWidth / 2; i <= trackWidth / 2; i += tieSpacing) {
    ctx.fillRect(-railWidth * 3, i - 1 * zoom, railWidth * 6, 2 * zoom);
  }

  // Draw rails
  ctx.fillStyle = colors.rail;
  ctx.fillRect(-railWidth * 2.5, -trackWidth / 2, railWidth, trackWidth);
  ctx.fillRect(railWidth * 1.5, -trackWidth / 2, railWidth, trackWidth);

  // Rail highlights
  ctx.fillStyle = colors.highlight;
  ctx.fillRect(-railWidth * 2.5, -trackWidth / 2, railWidth * 0.3, trackWidth);
  ctx.fillRect(railWidth * 1.5, -trackWidth / 2, railWidth * 0.3, trackWidth);

  ctx.restore();
}

/**
 * Draw a curved track piece
 */
function drawCurvedTrack(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  direction: number,
  turnDirection: 'left' | 'right',
  zoom: number,
  colors: typeof TRACK_COLORS.default
): void {
  const radius = 20 * zoom;
  const railWidth = 3 * zoom;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((direction * 45 * Math.PI) / 180);

  const centerX = turnDirection === 'left' ? -radius : radius;
  const startAngle = turnDirection === 'left' ? 0 : Math.PI;
  const endAngle = turnDirection === 'left' ? Math.PI / 2 : Math.PI / 2;

  // Outer rail
  ctx.strokeStyle = colors.rail;
  ctx.lineWidth = railWidth;
  ctx.beginPath();
  ctx.arc(centerX, 0, radius + 5 * zoom, startAngle, startAngle + Math.PI / 2, turnDirection === 'right');
  ctx.stroke();

  // Inner rail
  ctx.beginPath();
  ctx.arc(centerX, 0, radius - 5 * zoom, startAngle, startAngle + Math.PI / 2, turnDirection === 'right');
  ctx.stroke();

  // Rail highlight
  ctx.strokeStyle = colors.highlight;
  ctx.lineWidth = railWidth * 0.3;
  ctx.beginPath();
  ctx.arc(centerX, 0, radius + 5 * zoom, startAngle, startAngle + Math.PI / 2, turnDirection === 'right');
  ctx.stroke();

  ctx.restore();
}

/**
 * Draw a slope track piece
 */
function drawSlopeTrack(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  direction: number,
  slopeHeight: number,
  zoom: number,
  colors: typeof TRACK_COLORS.default
): void {
  const trackLength = 30 * zoom;
  const railWidth = 3 * zoom;

  ctx.save();
  ctx.translate(x, y);

  // Calculate slope angle
  const slopeAngle = Math.atan2(slopeHeight * 4 * zoom, trackLength);
  ctx.rotate((direction * 45 * Math.PI) / 180);

  // Draw sloped rails
  ctx.strokeStyle = colors.rail;
  ctx.lineWidth = railWidth;

  // Left rail
  ctx.beginPath();
  ctx.moveTo(-5 * zoom, 0);
  ctx.lineTo(-5 * zoom - trackLength * Math.cos(slopeAngle), slopeHeight * 4 * zoom);
  ctx.stroke();

  // Right rail
  ctx.beginPath();
  ctx.moveTo(5 * zoom, 0);
  ctx.lineTo(5 * zoom - trackLength * Math.cos(slopeAngle), slopeHeight * 4 * zoom);
  ctx.stroke();

  // Highlight
  ctx.strokeStyle = colors.highlight;
  ctx.lineWidth = railWidth * 0.3;
  ctx.beginPath();
  ctx.moveTo(-5 * zoom, 0);
  ctx.lineTo(-5 * zoom - trackLength * Math.cos(slopeAngle), slopeHeight * 4 * zoom);
  ctx.stroke();

  ctx.restore();
}

/**
 * Draw a special element (loop, corkscrew, etc.)
 */
function drawSpecialElement(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  type: string,
  direction: number,
  zoom: number,
  colors: typeof TRACK_COLORS.default
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((direction * 45 * Math.PI) / 180);

  if (type.includes('loop')) {
    // Draw vertical loop
    const loopRadius = 20 * zoom;
    
    ctx.strokeStyle = colors.rail;
    ctx.lineWidth = 3 * zoom;
    ctx.beginPath();
    ctx.arc(0, -loopRadius, loopRadius, 0, Math.PI * 2);
    ctx.stroke();
    
    // Support structure
    ctx.strokeStyle = colors.support;
    ctx.lineWidth = 2 * zoom;
    ctx.beginPath();
    ctx.moveTo(-loopRadius, 0);
    ctx.lineTo(-loopRadius, -loopRadius * 2);
    ctx.moveTo(loopRadius, 0);
    ctx.lineTo(loopRadius, -loopRadius * 2);
    ctx.stroke();
  } else if (type.includes('corkscrew')) {
    // Draw corkscrew (simplified spiral)
    const spiralHeight = 30 * zoom;
    const spiralWidth = 15 * zoom;
    
    ctx.strokeStyle = colors.rail;
    ctx.lineWidth = 3 * zoom;
    ctx.beginPath();
    for (let i = 0; i <= 360; i += 10) {
      const rad = (i * Math.PI) / 180;
      const progress = i / 360;
      const x = Math.sin(rad) * spiralWidth * (1 - progress * 0.3);
      const y = -progress * spiralHeight;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  } else if (type.includes('chain')) {
    // Draw chain lift
    drawStraightTrack(ctx, 0, 0, 0, zoom, colors);
    
    // Add chain indicator
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2 * zoom;
    ctx.setLineDash([3 * zoom, 3 * zoom]);
    ctx.beginPath();
    ctx.moveTo(0, -15 * zoom);
    ctx.lineTo(0, 15 * zoom);
    ctx.stroke();
    ctx.setLineDash([]);
  } else if (type === 'station') {
    // Draw station platform
    const platformWidth = 40 * zoom;
    const platformHeight = 6 * zoom;
    
    // Platform base
    ctx.fillStyle = '#6b7280';
    ctx.fillRect(-platformWidth / 2, -3 * zoom, platformWidth, platformHeight);
    
    // Canopy
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(-platformWidth / 2 - 5 * zoom, -15 * zoom, platformWidth + 10 * zoom, 3 * zoom);
    
    // Support poles
    ctx.fillStyle = '#4b5563';
    ctx.fillRect(-platformWidth / 2, -15 * zoom, 3 * zoom, 15 * zoom);
    ctx.fillRect(platformWidth / 2 - 3 * zoom, -15 * zoom, 3 * zoom, 15 * zoom);
    
    // Track
    drawStraightTrack(ctx, 0, 0, 0, zoom, colors);
  } else if (type.includes('brake')) {
    // Draw brakes
    drawStraightTrack(ctx, 0, 0, 0, zoom, colors);
    
    // Brake fins
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(-8 * zoom, -10 * zoom, 2 * zoom, 20 * zoom);
    ctx.fillRect(6 * zoom, -10 * zoom, 2 * zoom, 20 * zoom);
  } else if (type.includes('booster')) {
    // Draw booster
    drawStraightTrack(ctx, 0, 0, 0, zoom, colors);
    
    // Booster indicator
    ctx.fillStyle = '#22c55e';
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * 5 * zoom);
      ctx.lineTo(8 * zoom, i * 5 * zoom + 3 * zoom);
      ctx.lineTo(0, i * 5 * zoom + 6 * zoom);
      ctx.closePath();
      ctx.fill();
    }
  }

  ctx.restore();
}

/**
 * Draw a complete track element
 */
export function drawTrackElement(
  ctx: CanvasRenderingContext2D,
  element: TrackElement,
  offsetX: number,
  offsetY: number,
  zoom: number,
  coasterType: string = 'steel_coaster',
  isSelected: boolean = false
): void {
  const pieceDef = TRACK_PIECES[element.type];
  if (!pieceDef) return;

  // Determine track colors based on coaster type
  let colors = TRACK_COLORS.default;
  if (coasterType.includes('wooden')) {
    colors = TRACK_COLORS.wooden;
  } else if (coasterType.includes('inverted') || coasterType.includes('suspended')) {
    colors = TRACK_COLORS.inverted;
  } else if (coasterType.includes('water') || coasterType.includes('flume')) {
    colors = TRACK_COLORS.water;
  }

  const screen = gridToScreen(element.x, element.y, element.height, offsetX, offsetY, zoom);

  // Draw support first (underneath)
  if (element.height > 0 && zoom > 0.4) {
    drawSupport(ctx, screen.x, screen.y, element.height, zoom, colors);
  }

  // Draw the track piece
  const type = element.type;
  
  if (type.includes('turn') || type.includes('corner')) {
    const isLeft = type.includes('left');
    drawCurvedTrack(ctx, screen.x, screen.y, element.direction, isLeft ? 'left' : 'right', zoom, colors);
  } else if (type.includes('slope') && !type.includes('flat')) {
    const isUp = type.includes('up');
    const slopeHeight = type.includes('60') ? 4 : type.includes('90') ? 6 : 2;
    drawSlopeTrack(ctx, screen.x, screen.y, element.direction, isUp ? slopeHeight : -slopeHeight, zoom, colors);
  } else if (
    type.includes('loop') || 
    type.includes('corkscrew') || 
    type.includes('roll') ||
    type.includes('chain') ||
    type === 'station' ||
    type.includes('brake') ||
    type.includes('booster')
  ) {
    drawSpecialElement(ctx, screen.x, screen.y, type, element.direction, zoom, colors);
  } else {
    drawStraightTrack(ctx, screen.x, screen.y, element.direction, zoom, colors);
  }

  // Selection highlight
  if (isSelected) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, 15 * zoom, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/**
 * Draw all track for a ride
 */
export function drawRideTrack(
  ctx: CanvasRenderingContext2D,
  ride: Ride,
  offsetX: number,
  offsetY: number,
  zoom: number,
  selectedElementIndex: number = -1
): void {
  // Sort track elements by depth for proper rendering
  const sortedTrack = [...ride.track].sort((a, b) => {
    const depthA = a.x + a.y - a.height * 0.1;
    const depthB = b.x + b.y - b.height * 0.1;
    return depthA - depthB;
  });

  for (let i = 0; i < sortedTrack.length; i++) {
    const element = sortedTrack[i];
    const originalIndex = ride.track.indexOf(element);
    drawTrackElement(
      ctx,
      element,
      offsetX,
      offsetY,
      zoom,
      ride.type,
      originalIndex === selectedElementIndex
    );
  }
}
