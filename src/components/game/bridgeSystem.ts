/**
 * Bridge System - Detection, generation, and rendering of bridges
 * Bridges are automatically created when roads are placed across water
 */

import { Tile, Building, BridgeType, BridgeOrientation } from '@/types/game';
import { TILE_WIDTH, TILE_HEIGHT } from './types';

// ============================================================================
// Constants
// ============================================================================

/** Maximum width of water a bridge can span */
export const MAX_BRIDGE_SPAN = 10;

/** Bridge type based on span width */
export const BRIDGE_TYPE_THRESHOLDS = {
  large: 5,    // 1-5 tiles = truss bridge
  suspension: 10, // 6-10 tiles = suspension bridge
} as const;

/** Bridge visual variants per type */
export const BRIDGE_VARIANTS: Record<BridgeType, number> = {
  small: 3,      // Wooden, stone arch, cobblestone
  medium: 3,     // Concrete beam, modern deck, arched concrete
  large: 2,      // Steel truss, box girder
  suspension: 2, // Cable-stayed, classic suspension
};

/** Bridge colors by type and variant */
export const BRIDGE_COLORS: Record<BridgeType, string[][]> = {
  small: [
    ['#8B4513', '#654321', '#A0522D'], // Wooden - brown tones
    ['#808080', '#696969', '#A9A9A9'], // Stone - gray tones
    ['#6B4423', '#8B6914', '#CD853F'], // Cobblestone - earthy tones
  ],
  medium: [
    ['#808080', '#A9A9A9', '#C0C0C0'], // Concrete beam - gray
    ['#4a5568', '#718096', '#a0aec0'], // Modern deck - blue-gray
    ['#696969', '#808080', '#D3D3D3'], // Arched concrete
  ],
  large: [
    ['#2F4F4F', '#708090', '#778899'], // Steel truss - dark steel
    ['#4a4a4a', '#5a5a5a', '#6b6b6b'], // Box girder - dark gray
  ],
  suspension: [
    ['#C0C0C0', '#A9A9A9', '#DC143C'], // Cable-stayed - silver with red accents
    ['#FF4500', '#C0C0C0', '#808080'], // Classic suspension - orange cables
  ],
};

// ============================================================================
// Bridge Detection
// ============================================================================

/**
 * Check if a tile is water
 */
export function isWater(grid: Tile[][], gridSize: number, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) return false;
  return grid[y][x].building.type === 'water';
}

/**
 * Check if a tile is a road or bridge
 */
export function isRoadOrBridge(grid: Tile[][], gridSize: number, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) return false;
  const type = grid[y][x].building.type;
  return type === 'road' || type === 'bridge';
}

/**
 * Check if a tile is buildable land (not water)
 */
export function isLand(grid: Tile[][], gridSize: number, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) return false;
  return grid[y][x].building.type !== 'water';
}

/**
 * Detect if placing a road at (x, y) would create a bridge opportunity
 * Returns bridge info if a valid bridge can be created
 */
export interface BridgeOpportunity {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  orientation: BridgeOrientation;
  span: number; // Number of water tiles to bridge
  bridgeType: BridgeType;
  waterTiles: { x: number; y: number }[]; // Tiles that need to become bridges
}

/**
 * Scan for a bridge opportunity in a specific direction
 */
function scanForBridgeInDirection(
  grid: Tile[][],
  gridSize: number,
  startX: number,
  startY: number,
  dx: number,
  dy: number,
  orientation: BridgeOrientation
): BridgeOpportunity | null {
  const waterTiles: { x: number; y: number }[] = [];
  let x = startX + dx;
  let y = startY + dy;
  
  // Count consecutive water tiles
  while (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
    const tile = grid[y][x];
    
    if (tile.building.type === 'water') {
      waterTiles.push({ x, y });
      
      // Check if we've exceeded max bridge span
      if (waterTiles.length > MAX_BRIDGE_SPAN) {
        return null; // Too wide to bridge
      }
    } else if (tile.building.type === 'road' || tile.building.type === 'bridge') {
      // Found a road/bridge on the other side - valid bridge opportunity!
      if (waterTiles.length > 0) {
        const span = waterTiles.length;
        const bridgeType = getBridgeTypeForSpan(span);
        
        return {
          startX,
          startY,
          endX: x,
          endY: y,
          orientation,
          span,
          bridgeType,
          waterTiles,
        };
      }
      return null;
    } else {
      // Found land that's not a road - no bridge possible in this direction
      break;
    }
    
    x += dx;
    y += dy;
  }
  
  return null;
}

/**
 * Check all four directions for bridge opportunities from a road tile
 */
export function detectBridgeOpportunity(
  grid: Tile[][],
  gridSize: number,
  x: number,
  y: number
): BridgeOpportunity | null {
  const tile = grid[y]?.[x];
  if (!tile) return null;
  
  // Only check from road tiles
  if (tile.building.type !== 'road' && tile.building.type !== 'bridge') {
    return null;
  }
  
  // Check each direction for water followed by road
  // North (x-1, y stays same in grid coords)
  const northOpp = scanForBridgeInDirection(grid, gridSize, x, y, -1, 0, 'ns');
  if (northOpp) return northOpp;
  
  // South (x+1, y stays same)
  const southOpp = scanForBridgeInDirection(grid, gridSize, x, y, 1, 0, 'ns');
  if (southOpp) return southOpp;
  
  // East (x stays, y-1)
  const eastOpp = scanForBridgeInDirection(grid, gridSize, x, y, 0, -1, 'ew');
  if (eastOpp) return eastOpp;
  
  // West (x stays, y+1)
  const westOpp = scanForBridgeInDirection(grid, gridSize, x, y, 0, 1, 'ew');
  if (westOpp) return westOpp;
  
  return null;
}

/**
 * Get the appropriate bridge type for a given span
 */
export function getBridgeTypeForSpan(span: number): BridgeType {
  // 1-tile bridges are simple bridges without trusses
  if (span === 1) return 'small';
  if (span <= BRIDGE_TYPE_THRESHOLDS.large) return 'large';
  return 'suspension';
}

/**
 * Generate a random variant for a bridge type
 */
export function getRandomBridgeVariant(bridgeType: BridgeType): number {
  return Math.floor(Math.random() * BRIDGE_VARIANTS[bridgeType]);
}

/**
 * Create a bridge building at the specified position
 */
export function createBridgeBuilding(
  bridgeType: BridgeType,
  orientation: BridgeOrientation,
  variant: number,
  position: 'start' | 'middle' | 'end',
  index: number,
  span: number
): Building {
  return {
    type: 'bridge',
    level: 0,
    population: 0,
    jobs: 0,
    powered: true,
    watered: true,
    onFire: false,
    fireProgress: 0,
    age: 0,
    constructionProgress: 100,
    abandoned: false,
    bridgeType,
    bridgeOrientation: orientation,
    bridgeVariant: variant,
    bridgePosition: position,
    bridgeIndex: index,
    bridgeSpan: span,
  };
}

/**
 * Build bridges for an opportunity, modifying the grid in place
 */
export function buildBridges(
  grid: Tile[][],
  opportunity: BridgeOpportunity
): void {
  const variant = getRandomBridgeVariant(opportunity.bridgeType);
  
  // Sort waterTiles consistently to ensure same result regardless of drag direction
  // For NS orientation (bridges going NW-SE in screen): sort by x (grid row), then by y
  // For EW orientation (bridges going NE-SW in screen): sort by y (grid column), then by x
  const sortedTiles = [...opportunity.waterTiles].sort((a, b) => {
    if (opportunity.orientation === 'ns') {
      // NS bridges: sort by x first (north to south in grid = top-left to bottom-right on screen)
      return a.x !== b.x ? a.x - b.x : a.y - b.y;
    } else {
      // EW bridges: sort by y first (east to west in grid = top-right to bottom-left on screen)
      return a.y !== b.y ? a.y - b.y : a.x - b.x;
    }
  });
  
  const span = sortedTiles.length;
  sortedTiles.forEach((pos, index) => {
    let position: 'start' | 'middle' | 'end';
    if (index === 0) {
      position = 'start';
    } else if (index === sortedTiles.length - 1) {
      position = 'end';
    } else {
      position = 'middle';
    }
    
    const tile = grid[pos.y][pos.x];
    tile.building = createBridgeBuilding(
      opportunity.bridgeType,
      opportunity.orientation,
      variant,
      position,
      index,
      span
    );
  });
}

// ============================================================================
// Bridge Rendering
// ============================================================================

/**
 * Get bridge colors for rendering
 */
export function getBridgeColors(bridgeType: BridgeType, variant: number): { deck: string; support: string; accent: string } {
  const colors = BRIDGE_COLORS[bridgeType][variant] || BRIDGE_COLORS[bridgeType][0];
  return {
    deck: colors[0],
    support: colors[1],
    accent: colors[2],
  };
}

/**
 * Draw a bridge tile on the canvas
 */
export function drawBridge(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  building: Building,
  zoom: number
): void {
  if (building.type !== 'bridge') return;
  
  const bridgeType = building.bridgeType || 'large';
  const orientation = building.bridgeOrientation || 'ns';
  const variant = building.bridgeVariant || 0;
  const position = building.bridgePosition || 'middle';
  const bridgeSpan = building.bridgeSpan ?? 1;
  const isRailBridge = building.bridgeTrackType === 'rail';
  
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  
  // Get colors for this bridge variant
  const colors = getBridgeColors(bridgeType, variant);
  
  // Diamond corner points for the tile
  const topX = screenX + w / 2;
  const topY = screenY;
  const rightX = screenX + w;
  const rightY = screenY + h / 2;
  const bottomX = screenX + w / 2;
  const bottomY = screenY + h;
  const leftX = screenX;
  const leftY = screenY + h / 2;
  const centerX = screenX + w / 2;
  const centerY = screenY + h / 2;
  
  // Save context
  ctx.save();
  
  // Draw based on bridge type
  switch (bridgeType) {
    case 'small':
      drawSmallBridge(ctx, screenX, screenY, orientation, position, colors, zoom);
      break;
    case 'medium':
      drawMediumBridge(ctx, screenX, screenY, orientation, position, colors, zoom);
      break;
    case 'large':
      drawLargeBridge(ctx, screenX, screenY, orientation, position, colors, zoom, isRailBridge, bridgeSpan);
      break;
    case 'suspension':
      drawSuspensionBridge(ctx, screenX, screenY, orientation, position, colors, zoom);
      break;
  }
  
  ctx.restore();
}

/**
 * Draw a small bridge (wooden/stone)
 */
function drawSmallBridge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  orientation: BridgeOrientation,
  position: 'start' | 'middle' | 'end',
  colors: { deck: string; support: string; accent: string },
  zoom: number
): void {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = x + w / 2;
  const cy = y + h / 2;
  
  // Support pillars - draw cylindrical stone/wood supports
  const pillarWidth = w * 0.08;
  const pillarHeight = h * 0.4;
  
  ctx.fillStyle = colors.support;
  
  if (position === 'start' || position === 'end') {
    // Draw support pillars at bridge ends
    if (orientation === 'ns') {
      // Pillars on east and west sides
      drawPillar(ctx, cx - w * 0.2, cy + h * 0.1, pillarWidth, pillarHeight);
      drawPillar(ctx, cx + w * 0.2, cy + h * 0.1, pillarWidth, pillarHeight);
    } else {
      // Pillars on north and south sides
      drawPillar(ctx, cx - w * 0.15, cy + h * 0.05, pillarWidth, pillarHeight);
      drawPillar(ctx, cx + w * 0.15, cy + h * 0.15, pillarWidth, pillarHeight);
    }
  }
  
  // Draw the bridge deck (road surface)
  const deckWidth = w * 0.45;
  const deckThickness = h * 0.08;
  
  ctx.fillStyle = colors.deck;
  
  if (orientation === 'ns') {
    // Bridge runs north-south (top-left to bottom-right on screen)
    const halfDeck = deckWidth / 2;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.25, cy - deckThickness);
    ctx.lineTo(x + w * 0.75, cy - deckThickness);
    ctx.lineTo(x + w * 0.75, cy + deckThickness);
    ctx.lineTo(x + w * 0.25, cy + deckThickness);
    ctx.closePath();
    ctx.fill();
    
    // Add deck details (planks for wooden, stones for stone)
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 4; i++) {
      const px = x + w * 0.3 + i * w * 0.12;
      ctx.beginPath();
      ctx.moveTo(px, cy - deckThickness);
      ctx.lineTo(px, cy + deckThickness);
      ctx.stroke();
    }
  } else {
    // Bridge runs east-west (top-right to bottom-left on screen)
    ctx.beginPath();
    ctx.moveTo(cx - deckWidth / 2, y + h * 0.25);
    ctx.lineTo(cx + deckWidth / 2, y + h * 0.25);
    ctx.lineTo(cx + deckWidth / 2, y + h * 0.75);
    ctx.lineTo(cx - deckWidth / 2, y + h * 0.75);
    ctx.closePath();
    ctx.fill();
    
    // Add deck details
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 4; i++) {
      const py = y + h * 0.3 + i * h * 0.12;
      ctx.beginPath();
      ctx.moveTo(cx - deckWidth / 2, py);
      ctx.lineTo(cx + deckWidth / 2, py);
      ctx.stroke();
    }
  }
  
  // Draw side railings
  ctx.strokeStyle = colors.accent;
  ctx.lineWidth = 1;
  
  if (orientation === 'ns') {
    // Left railing
    ctx.beginPath();
    ctx.moveTo(x + w * 0.25, cy - deckThickness - 2);
    ctx.lineTo(x + w * 0.75, cy - deckThickness - 2);
    ctx.stroke();
    // Right railing
    ctx.beginPath();
    ctx.moveTo(x + w * 0.25, cy + deckThickness + 2);
    ctx.lineTo(x + w * 0.75, cy + deckThickness + 2);
    ctx.stroke();
  } else {
    // Top railing
    ctx.beginPath();
    ctx.moveTo(cx - deckWidth / 2 - 2, y + h * 0.25);
    ctx.lineTo(cx - deckWidth / 2 - 2, y + h * 0.75);
    ctx.stroke();
    // Bottom railing
    ctx.beginPath();
    ctx.moveTo(cx + deckWidth / 2 + 2, y + h * 0.25);
    ctx.lineTo(cx + deckWidth / 2 + 2, y + h * 0.75);
    ctx.stroke();
  }
}

/**
 * Draw a medium bridge (concrete)
 */
function drawMediumBridge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  orientation: BridgeOrientation,
  position: 'start' | 'middle' | 'end',
  colors: { deck: string; support: string; accent: string },
  zoom: number
): void {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = x + w / 2;
  const cy = y + h / 2;
  
  // Draw support beams under the deck
  const beamHeight = h * 0.35;
  ctx.fillStyle = colors.support;
  
  if (position === 'start' || position === 'end' || position === 'middle') {
    if (orientation === 'ns') {
      // Vertical concrete beam under deck
      ctx.fillRect(cx - w * 0.08, cy + h * 0.1, w * 0.16, beamHeight);
    } else {
      // Horizontal concrete beam under deck
      ctx.fillRect(cx - w * 0.08, cy + h * 0.05, w * 0.16, beamHeight);
    }
  }
  
  // Draw the main deck
  const deckWidth = w * 0.5;
  const deckHeight = h * 0.12;
  
  ctx.fillStyle = colors.deck;
  
  if (orientation === 'ns') {
    ctx.fillRect(x + w * 0.25 - 2, cy - deckHeight / 2, deckWidth + 4, deckHeight);
    // Road surface markings
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.8;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(x + w * 0.25, cy);
    ctx.lineTo(x + w * 0.75, cy);
    ctx.stroke();
    ctx.setLineDash([]);
  } else {
    ctx.fillRect(cx - deckWidth / 2, y + h * 0.2, deckWidth, h * 0.6);
    // Road surface markings
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.8;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(cx, y + h * 0.2);
    ctx.lineTo(cx, y + h * 0.8);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  
  // Draw concrete barriers/railings
  ctx.fillStyle = colors.accent;
  const barrierHeight = 3;
  
  if (orientation === 'ns') {
    ctx.fillRect(x + w * 0.23, cy - deckHeight / 2 - barrierHeight, deckWidth + 8, barrierHeight);
    ctx.fillRect(x + w * 0.23, cy + deckHeight / 2, deckWidth + 8, barrierHeight);
  } else {
    ctx.fillRect(cx - deckWidth / 2 - barrierHeight, y + h * 0.18, barrierHeight, h * 0.64);
    ctx.fillRect(cx + deckWidth / 2, y + h * 0.18, barrierHeight, h * 0.64);
  }
}

/**
 * Draw a large bridge (steel truss)
 */
function drawLargeBridge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  orientation: BridgeOrientation,
  position: 'start' | 'middle' | 'end',
  colors: { deck: string; support: string; accent: string },
  zoom: number,
  isRailBridge: boolean = false,
  bridgeSpan: number = 1
): void {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = x + w / 2;
  const cy = y + h / 2;
  
  // Draw support towers at ends
  if (position === 'start' || position === 'end') {
    ctx.fillStyle = colors.support;
    const towerWidth = w * 0.1;
    const towerHeight = h * 0.6;
    
    if (orientation === 'ns') {
      // Two towers on each side
      drawTower(ctx, cx - w * 0.25, cy - towerHeight * 0.3, towerWidth, towerHeight);
      drawTower(ctx, cx + w * 0.15, cy - towerHeight * 0.3, towerWidth, towerHeight);
    } else {
      drawTower(ctx, cx - towerWidth / 2, cy - towerHeight * 0.4, towerWidth, towerHeight);
    }
  }
  
  // Draw steel truss structure above deck (skip for rail bridges and 1-tile bridges)
  if (!isRailBridge && bridgeSpan > 1) {
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = 1.5;
    
    const trussHeight = h * 0.25;
    const deckY = cy;
  
  if (orientation === 'ns') {
    const leftEdge = x + w * 0.2;
    const rightEdge = x + w * 0.8;
    
    // Top beam
    ctx.beginPath();
    ctx.moveTo(leftEdge, deckY - trussHeight);
    ctx.lineTo(rightEdge, deckY - trussHeight);
    ctx.stroke();
    
    // Bottom beam (deck level)
    ctx.beginPath();
    ctx.moveTo(leftEdge, deckY);
    ctx.lineTo(rightEdge, deckY);
    ctx.stroke();
    
    // Diagonal supports
    const numDiagonals = 4;
    for (let i = 0; i <= numDiagonals; i++) {
      const px = leftEdge + (rightEdge - leftEdge) * (i / numDiagonals);
      ctx.beginPath();
      ctx.moveTo(px, deckY);
      ctx.lineTo(px, deckY - trussHeight);
      ctx.stroke();
      
      if (i < numDiagonals) {
        const nextPx = leftEdge + (rightEdge - leftEdge) * ((i + 1) / numDiagonals);
        ctx.beginPath();
        ctx.moveTo(px, deckY);
        ctx.lineTo(nextPx, deckY - trussHeight);
        ctx.stroke();
      }
    }
  } else {
    const topEdge = y + h * 0.15;
    const bottomEdge = y + h * 0.85;
    
    // Left beam
    ctx.beginPath();
    ctx.moveTo(cx - trussHeight, topEdge);
    ctx.lineTo(cx - trussHeight, bottomEdge);
    ctx.stroke();
    
    // Right beam (deck level)
    ctx.beginPath();
    ctx.moveTo(cx, topEdge);
    ctx.lineTo(cx, bottomEdge);
    ctx.stroke();
    
    // Diagonal supports
    const numDiagonals = 4;
    for (let i = 0; i <= numDiagonals; i++) {
      const py = topEdge + (bottomEdge - topEdge) * (i / numDiagonals);
      ctx.beginPath();
      ctx.moveTo(cx, py);
      ctx.lineTo(cx - trussHeight, py);
      ctx.stroke();
    }
  }
  }
  
  // Draw the deck
  ctx.fillStyle = colors.deck;
  const deckWidth = w * 0.5;
  const deckThickness = h * 0.1;
  
  if (orientation === 'ns') {
    ctx.fillRect(x + w * 0.25, cy - deckThickness / 2, deckWidth, deckThickness);
  } else {
    ctx.fillRect(cx - deckWidth / 2, y + h * 0.25, deckWidth, h * 0.5);
  }
}

/**
 * Draw a suspension bridge
 */
function drawSuspensionBridge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  orientation: BridgeOrientation,
  position: 'start' | 'middle' | 'end',
  colors: { deck: string; support: string; accent: string },
  zoom: number
): void {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = x + w / 2;
  const cy = y + h / 2;
  
  // Draw main towers at ends
  if (position === 'start' || position === 'end') {
    ctx.fillStyle = colors.support;
    const towerWidth = w * 0.08;
    const towerHeight = h * 0.8;
    
    if (orientation === 'ns') {
      // Twin towers
      drawTower(ctx, cx - w * 0.2, cy - towerHeight * 0.5, towerWidth, towerHeight);
      drawTower(ctx, cx + w * 0.12, cy - towerHeight * 0.5, towerWidth, towerHeight);
    } else {
      drawTower(ctx, cx - w * 0.1, cy - towerHeight * 0.6, towerWidth, towerHeight);
      drawTower(ctx, cx + w * 0.02, cy - towerHeight * 0.6, towerWidth, towerHeight);
    }
  }
  
  // Draw main cables (catenary curve)
  ctx.strokeStyle = colors.accent;
  ctx.lineWidth = 2;
  
  const cableHeight = h * 0.35;
  const cableSag = h * 0.15;
  
  if (orientation === 'ns') {
    const leftEdge = x + w * 0.1;
    const rightEdge = x + w * 0.9;
    
    // Main cable curve
    ctx.beginPath();
    ctx.moveTo(leftEdge, cy - cableHeight);
    ctx.quadraticCurveTo(cx, cy - cableHeight + cableSag, rightEdge, cy - cableHeight);
    ctx.stroke();
  } else {
    const topEdge = y + h * 0.05;
    const bottomEdge = y + h * 0.95;
    
    ctx.beginPath();
    ctx.moveTo(cx - cableHeight, topEdge);
    ctx.quadraticCurveTo(cx - cableHeight + cableSag, cy, cx - cableHeight, bottomEdge);
    ctx.stroke();
  }
  
  // Draw vertical suspender cables
  ctx.strokeStyle = colors.accent;
  ctx.lineWidth = 0.5;
  
  const numSuspenders = 6;
  
  if (orientation === 'ns') {
    const leftEdge = x + w * 0.15;
    const rightEdge = x + w * 0.85;
    const deckLevel = cy;
    
    for (let i = 0; i <= numSuspenders; i++) {
      const t = i / numSuspenders;
      const px = leftEdge + (rightEdge - leftEdge) * t;
      // Parabolic cable height
      const sagAmount = cableSag * Math.sin(t * Math.PI);
      const cableY = cy - cableHeight + sagAmount;
      
      ctx.beginPath();
      ctx.moveTo(px, cableY);
      ctx.lineTo(px, deckLevel);
      ctx.stroke();
    }
  } else {
    const topEdge = y + h * 0.1;
    const bottomEdge = y + h * 0.9;
    const deckLevel = cx;
    
    for (let i = 0; i <= numSuspenders; i++) {
      const t = i / numSuspenders;
      const py = topEdge + (bottomEdge - topEdge) * t;
      const sagAmount = cableSag * Math.sin(t * Math.PI);
      const cableX = cx - cableHeight + sagAmount;
      
      ctx.beginPath();
      ctx.moveTo(cableX, py);
      ctx.lineTo(deckLevel, py);
      ctx.stroke();
    }
  }
  
  // Draw the deck
  ctx.fillStyle = colors.deck;
  const deckWidth = w * 0.55;
  const deckThickness = h * 0.1;
  
  if (orientation === 'ns') {
    ctx.fillRect(x + w * 0.225, cy - deckThickness / 2, deckWidth, deckThickness);
    // Road markings
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.8;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(x + w * 0.225, cy);
    ctx.lineTo(x + w * 0.775, cy);
    ctx.stroke();
    ctx.setLineDash([]);
  } else {
    ctx.fillRect(cx - deckWidth / 2, y + h * 0.2, deckWidth, h * 0.6);
    // Road markings
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.8;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(cx, y + h * 0.2);
    ctx.lineTo(cx, y + h * 0.8);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

// ============================================================================
// Helper Drawing Functions
// ============================================================================

/**
 * Draw a support pillar
 */
function drawPillar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number
): void {
  // Simple rectangular pillar with slight 3D effect
  ctx.fillRect(x - width / 2, y, width, height);
  
  // Add shading
  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.fillRect(x - width / 2, y, width / 3, height);
}

/**
 * Draw a bridge tower
 */
function drawTower(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number
): void {
  // Main tower body
  ctx.fillRect(x, y, width, height);
  
  // Add 3D shading
  const originalFill = ctx.fillStyle;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.fillRect(x, y, width / 3, height);
  ctx.fillStyle = originalFill;
  
  // Tower cap
  ctx.fillRect(x - width * 0.2, y - height * 0.05, width * 1.4, height * 0.08);
}

