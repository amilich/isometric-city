/**
 * Bridge System - Handles bridge detection, generation, and rendering
 * Bridges are created when roads span water tiles (up to 10 tiles wide)
 */

import { Tile, BridgeType, BridgeVariant, BridgeInfo } from '@/types/game';
import { TILE_WIDTH, TILE_HEIGHT } from './types';
import { BRIDGE_MAX_SPAN, BRIDGE_MIN_SPAN } from './constants';

// ============================================================================
// Constants
// ============================================================================

// Use the constants from constants.ts
const MAX_BRIDGE_SPAN = BRIDGE_MAX_SPAN;
const MIN_BRIDGE_SPAN = BRIDGE_MIN_SPAN;

/** Bridge type configurations based on span width */
export const BRIDGE_TYPE_CONFIG: Record<BridgeType, {
  minSpan: number;
  maxSpan: number;
  height: number;  // Visual height above water
  color: string;   // Primary color
  secondaryColor: string;
  supportsColor: string;
}> = {
  wooden_bridge: { minSpan: 1, maxSpan: 2, height: 3, color: '#8B4513', secondaryColor: '#A0522D', supportsColor: '#654321' },
  stone_bridge: { minSpan: 2, maxSpan: 3, height: 4, color: '#808080', secondaryColor: '#A9A9A9', supportsColor: '#696969' },
  steel_bridge: { minSpan: 3, maxSpan: 5, height: 5, color: '#4682B4', secondaryColor: '#87CEEB', supportsColor: '#2F4F4F' },
  beam_bridge: { minSpan: 4, maxSpan: 6, height: 5, color: '#696969', secondaryColor: '#A9A9A9', supportsColor: '#4a4a4a' },
  arch_bridge: { minSpan: 5, maxSpan: 7, height: 7, color: '#CD853F', secondaryColor: '#DEB887', supportsColor: '#8B7355' },
  suspension_bridge: { minSpan: 6, maxSpan: 8, height: 10, color: '#CD5C5C', secondaryColor: '#F08080', supportsColor: '#8B0000' },
  cable_stayed: { minSpan: 7, maxSpan: 10, height: 12, color: '#f5f5f5', secondaryColor: '#e0e0e0', supportsColor: '#c0c0c0' },
  golden_gate: { minSpan: 8, maxSpan: 10, height: 14, color: '#FF4500', secondaryColor: '#FF6347', supportsColor: '#8B0000' },
};

/** Get appropriate bridge type for a given span */
export function getBridgeTypeForSpan(span: number): BridgeType {
  // Select bridge type based on span, with some overlap for variety
  if (span <= 2) return 'wooden_bridge';
  if (span <= 3) return Math.random() > 0.5 ? 'stone_bridge' : 'wooden_bridge';
  if (span <= 4) return Math.random() > 0.5 ? 'steel_bridge' : 'stone_bridge';
  if (span <= 5) return Math.random() > 0.5 ? 'beam_bridge' : 'steel_bridge';
  if (span <= 6) return Math.random() > 0.5 ? 'arch_bridge' : 'beam_bridge';
  if (span <= 7) return Math.random() > 0.5 ? 'suspension_bridge' : 'arch_bridge';
  if (span <= 8) return Math.random() > 0.5 ? 'cable_stayed' : 'suspension_bridge';
  if (span <= 9) return Math.random() > 0.5 ? 'golden_gate' : 'cable_stayed';
  return 'golden_gate';
}

/** Generate a unique bridge ID */
function generateBridgeId(): string {
  return `bridge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// Bridge Detection Functions
// ============================================================================

/**
 * Check if a tile is water
 */
function isWater(grid: Tile[][], gridSize: number, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) return false;
  return grid[y][x].building.type === 'water';
}

/**
 * Check if a tile is a road or can connect to a road (land tiles)
 */
function isLandOrRoad(grid: Tile[][], gridSize: number, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) return false;
  const type = grid[y][x].building.type;
  return type !== 'water';
}

/**
 * Check if a tile is specifically a road
 */
function isRoad(grid: Tile[][], gridSize: number, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) return false;
  return grid[y][x].building.type === 'road';
}

/**
 * Detect if a road placement will create a bridge
 * Returns bridge info if a valid bridge can be created, null otherwise
 */
export function detectBridgeSpan(
  grid: Tile[][],
  gridSize: number,
  startX: number,
  startY: number,
  endX: number,
  endY: number
): { tiles: { x: number; y: number }[]; span: number; orientation: 'ns' | 'ew' } | null {
  // Determine direction
  const dx = endX - startX;
  const dy = endY - startY;

  // Must be a straight line (horizontal or vertical in grid terms)
  if (dx !== 0 && dy !== 0) return null;

  const isHorizontal = dy !== 0; // Moving along Y axis
  const orientation: 'ns' | 'ew' = isHorizontal ? 'ew' : 'ns';

  // Get all tiles in the path
  const tiles: { x: number; y: number }[] = [];
  const stepX = dx === 0 ? 0 : dx > 0 ? 1 : -1;
  const stepY = dy === 0 ? 0 : dy > 0 ? 1 : -1;

  let x = startX;
  let y = startY;

  while (true) {
    tiles.push({ x, y });
    if (x === endX && y === endY) break;
    x += stepX;
    y += stepY;
  }

  // Find water tiles in the path
  const waterTiles = tiles.filter(t => isWater(grid, gridSize, t.x, t.y));

  // No water tiles = no bridge needed
  if (waterTiles.length === 0) return null;

  // Check if water span is valid (contiguous and within limits)
  if (waterTiles.length > MAX_BRIDGE_SPAN) return null;

  // Verify water tiles are contiguous
  let waterStart = -1;
  let waterEnd = -1;
  for (let i = 0; i < tiles.length; i++) {
    if (isWater(grid, gridSize, tiles[i].x, tiles[i].y)) {
      if (waterStart === -1) waterStart = i;
      waterEnd = i;
    }
  }

  // Check that all tiles between waterStart and waterEnd are water
  for (let i = waterStart; i <= waterEnd; i++) {
    if (!isWater(grid, gridSize, tiles[i].x, tiles[i].y)) {
      return null; // Non-contiguous water
    }
  }

  // Verify there's land on both sides
  const beforeWater = waterStart > 0;
  const afterWater = waterEnd < tiles.length - 1;

  if (!beforeWater || !afterWater) {
    // Check if the start/end of the path is at map edge or already has road
    const hasStartAnchor = waterStart === 0 && (
      startX === 0 || startY === 0 ||
      isRoad(grid, gridSize, startX - stepX, startY - stepY) ||
      isLandOrRoad(grid, gridSize, startX - stepX, startY - stepY)
    );
    const hasEndAnchor = waterEnd === tiles.length - 1 && (
      endX === gridSize - 1 || endY === gridSize - 1 ||
      isRoad(grid, gridSize, endX + stepX, endY + stepY) ||
      isLandOrRoad(grid, gridSize, endX + stepX, endY + stepY)
    );

    if (!beforeWater && !hasStartAnchor) return null;
    if (!afterWater && !hasEndAnchor) return null;
  }

  // Return the water tiles that will become bridge
  const bridgeTiles = tiles.slice(waterStart, waterEnd + 1);

  return {
    tiles: bridgeTiles,
    span: bridgeTiles.length,
    orientation,
  };
}

/**
 * Create bridge info for a set of tiles
 */
export function createBridgeInfo(
  span: number,
  position: number,
  orientation: 'ns' | 'ew',
  bridgeId?: string,
  bridgeType?: BridgeType,
  variant?: BridgeVariant
): BridgeInfo {
  const type = bridgeType || getBridgeTypeForSpan(span);
  const config = BRIDGE_TYPE_CONFIG[type];

  return {
    bridgeId: bridgeId || generateBridgeId(),
    bridgeType: type,
    variant: variant ?? (Math.floor(Math.random() * 3) as BridgeVariant),
    span,
    position,
    orientation,
    height: config.height,
  };
}

// ============================================================================
// Bridge Rendering Functions
// ============================================================================

/**
 * Draw a bridge tile (called during road rendering for bridge tiles)
 */
export function drawBridgeTile(
  ctx: CanvasRenderingContext2D,
  x: number, // Screen X
  y: number, // Screen Y
  bridgeInfo: BridgeInfo,
  zoom: number
): void {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const config = BRIDGE_TYPE_CONFIG[bridgeInfo.bridgeType];

  // Calculate bridge deck height offset
  const deckHeight = bridgeInfo.height * (zoom > 0.5 ? 1 : 0.8);

  // Diamond corner points
  const topCorner = { x: x + w / 2, y: y - deckHeight };
  const rightCorner = { x: x + w, y: y + h / 2 - deckHeight };
  const bottomCorner = { x: x + w / 2, y: y + h - deckHeight };
  const leftCorner = { x: x, y: y + h / 2 - deckHeight };

  // Draw supports first (pillars going into water)
  drawBridgeSupports(ctx, x, y, bridgeInfo, config, zoom);

  // Draw bridge deck
  drawBridgeDeck(ctx, topCorner, rightCorner, bottomCorner, leftCorner, bridgeInfo, config, zoom);

  // Draw bridge structure (cables, arches, etc.) based on type
  if (zoom >= 0.4) {
    drawBridgeStructure(ctx, x, y, bridgeInfo, config, zoom);
  }
}

/**
 * Draw bridge support pillars
 */
function drawBridgeSupports(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  bridgeInfo: BridgeInfo,
  config: typeof BRIDGE_TYPE_CONFIG[BridgeType],
  zoom: number
): void {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const deckHeight = bridgeInfo.height;

  // Determine if this tile should have supports
  const hasSupports = bridgeInfo.position === 0 ||
    bridgeInfo.position === bridgeInfo.span - 1 ||
    (bridgeInfo.span > 4 && bridgeInfo.position === Math.floor(bridgeInfo.span / 2));

  if (!hasSupports && bridgeInfo.span > 2) return;

  ctx.fillStyle = config.supportsColor;
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 0.5;

  // Draw pillars at corners of the tile
  const pillarWidth = w * 0.08;
  const pillarPositions = bridgeInfo.orientation === 'ns'
    ? [{ px: x + w * 0.3, py: y + h * 0.3 }, { px: x + w * 0.7, py: y + h * 0.7 }]
    : [{ px: x + w * 0.3, py: y + h * 0.7 }, { px: x + w * 0.7, py: y + h * 0.3 }];

  for (const pos of pillarPositions) {
    // Draw pillar body
    ctx.beginPath();
    ctx.moveTo(pos.px - pillarWidth, pos.py);
    ctx.lineTo(pos.px + pillarWidth, pos.py);
    ctx.lineTo(pos.px + pillarWidth, pos.py - deckHeight);
    ctx.lineTo(pos.px - pillarWidth, pos.py - deckHeight);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Add pillar base extending into water
    ctx.fillStyle = config.supportsColor;
    ctx.beginPath();
    ctx.ellipse(pos.px, pos.py + 2, pillarWidth * 1.3, pillarWidth * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = config.supportsColor;
  }
}

/**
 * Draw bridge deck (road surface)
 */
function drawBridgeDeck(
  ctx: CanvasRenderingContext2D,
  topCorner: { x: number; y: number },
  rightCorner: { x: number; y: number },
  bottomCorner: { x: number; y: number },
  leftCorner: { x: number; y: number },
  bridgeInfo: BridgeInfo,
  config: typeof BRIDGE_TYPE_CONFIG[BridgeType],
  zoom: number
): void {
  // Draw deck shadow first
  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.beginPath();
  ctx.moveTo(topCorner.x, topCorner.y + bridgeInfo.height);
  ctx.lineTo(rightCorner.x, rightCorner.y + bridgeInfo.height);
  ctx.lineTo(bottomCorner.x, bottomCorner.y + bridgeInfo.height);
  ctx.lineTo(leftCorner.x, leftCorner.y + bridgeInfo.height);
  ctx.closePath();
  ctx.fill();

  // Draw deck sides (3D effect)
  const deckThickness = 3;

  // Right face
  ctx.fillStyle = '#3a3a3a';
  ctx.beginPath();
  ctx.moveTo(rightCorner.x, rightCorner.y);
  ctx.lineTo(bottomCorner.x, bottomCorner.y);
  ctx.lineTo(bottomCorner.x, bottomCorner.y + deckThickness);
  ctx.lineTo(rightCorner.x, rightCorner.y + deckThickness);
  ctx.closePath();
  ctx.fill();

  // Left face
  ctx.fillStyle = '#2a2a2a';
  ctx.beginPath();
  ctx.moveTo(leftCorner.x, leftCorner.y);
  ctx.lineTo(bottomCorner.x, bottomCorner.y);
  ctx.lineTo(bottomCorner.x, bottomCorner.y + deckThickness);
  ctx.lineTo(leftCorner.x, leftCorner.y + deckThickness);
  ctx.closePath();
  ctx.fill();

  // Draw main deck surface (same as road)
  ctx.fillStyle = '#4a4a4a';
  ctx.beginPath();
  ctx.moveTo(topCorner.x, topCorner.y);
  ctx.lineTo(rightCorner.x, rightCorner.y);
  ctx.lineTo(bottomCorner.x, bottomCorner.y);
  ctx.lineTo(leftCorner.x, leftCorner.y);
  ctx.closePath();
  ctx.fill();

  // Draw deck edge railings
  if (zoom >= 0.5) {
    ctx.strokeStyle = config.secondaryColor;
    ctx.lineWidth = 1.5;

    // Top-left edge
    ctx.beginPath();
    ctx.moveTo(topCorner.x, topCorner.y);
    ctx.lineTo(leftCorner.x, leftCorner.y);
    ctx.stroke();

    // Top-right edge
    ctx.beginPath();
    ctx.moveTo(topCorner.x, topCorner.y);
    ctx.lineTo(rightCorner.x, rightCorner.y);
    ctx.stroke();
  }
}

/**
 * Draw bridge structure (cables, arches, towers based on type)
 */
function drawBridgeStructure(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  bridgeInfo: BridgeInfo,
  config: typeof BRIDGE_TYPE_CONFIG[BridgeType],
  zoom: number
): void {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const deckHeight = bridgeInfo.height;

  switch (bridgeInfo.bridgeType) {
    case 'wooden_bridge':
      // Simple wooden railings
      drawWoodenRailings(ctx, x, y, bridgeInfo, config, zoom);
      break;

    case 'stone_bridge':
      // Stone balustrade
      drawStoneBalustrade(ctx, x, y, bridgeInfo, config, zoom);
      break;

    case 'steel_bridge':
    case 'beam_bridge':
      // Steel truss structure
      drawSteelTruss(ctx, x, y, bridgeInfo, config, zoom);
      break;

    case 'arch_bridge':
      // Arch supports
      drawArchSupports(ctx, x, y, bridgeInfo, config, zoom);
      break;

    case 'suspension_bridge':
    case 'cable_stayed':
    case 'golden_gate':
      // Cable-stayed towers and cables
      drawCableStayed(ctx, x, y, bridgeInfo, config, zoom);
      break;
  }
}

/**
 * Draw wooden bridge railings
 */
function drawWoodenRailings(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  bridgeInfo: BridgeInfo,
  config: typeof BRIDGE_TYPE_CONFIG[BridgeType],
  zoom: number
): void {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const deckHeight = bridgeInfo.height;

  ctx.strokeStyle = config.color;
  ctx.lineWidth = 2;

  // Posts along edges
  const numPosts = 3;
  for (let i = 0; i < numPosts; i++) {
    const t = i / (numPosts - 1);

    // Left edge posts
    const lx = x + w * 0.1 + (x + w * 0.4 - x - w * 0.1) * t;
    const ly = y + h * 0.4 + (y + h * 0.9 - y - h * 0.4) * t - deckHeight;

    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(lx, ly - 6);
    ctx.stroke();

    // Right edge posts
    const rx = x + w * 0.6 + (x + w * 0.9 - x - w * 0.6) * t;
    const ry = y + h * 0.1 + (y + h * 0.6 - y - h * 0.1) * t - deckHeight;

    ctx.beginPath();
    ctx.moveTo(rx, ry);
    ctx.lineTo(rx, ry - 6);
    ctx.stroke();
  }

  // Horizontal rails
  ctx.lineWidth = 1.5;

  // Left railing
  ctx.beginPath();
  ctx.moveTo(x + w * 0.1, y + h * 0.4 - deckHeight - 5);
  ctx.lineTo(x + w * 0.4, y + h * 0.9 - deckHeight - 5);
  ctx.stroke();

  // Right railing
  ctx.beginPath();
  ctx.moveTo(x + w * 0.6, y + h * 0.1 - deckHeight - 5);
  ctx.lineTo(x + w * 0.9, y + h * 0.6 - deckHeight - 5);
  ctx.stroke();
}

/**
 * Draw stone bridge balustrade
 */
function drawStoneBalustrade(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  bridgeInfo: BridgeInfo,
  config: typeof BRIDGE_TYPE_CONFIG[BridgeType],
  zoom: number
): void {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const deckHeight = bridgeInfo.height;

  ctx.fillStyle = config.secondaryColor;
  ctx.strokeStyle = config.supportsColor;
  ctx.lineWidth = 0.5;

  // Draw stone pillars along edges
  const numPillars = 4;
  for (let i = 0; i < numPillars; i++) {
    const t = i / (numPillars - 1);

    // Left edge pillars
    const lx = x + w * 0.05 + (x + w * 0.45 - x - w * 0.05) * t;
    const ly = y + h * 0.45 + (y + h * 0.95 - y - h * 0.45) * t - deckHeight;

    ctx.fillRect(lx - 2, ly - 4, 4, 5);
    ctx.strokeRect(lx - 2, ly - 4, 4, 5);

    // Right edge pillars
    const rx = x + w * 0.55 + (x + w * 0.95 - x - w * 0.55) * t;
    const ry = y + h * 0.05 + (y + h * 0.55 - y - h * 0.05) * t - deckHeight;

    ctx.fillRect(rx - 2, ry - 4, 4, 5);
    ctx.strokeRect(rx - 2, ry - 4, 4, 5);
  }
}

/**
 * Draw steel truss structure
 */
function drawSteelTruss(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  bridgeInfo: BridgeInfo,
  config: typeof BRIDGE_TYPE_CONFIG[BridgeType],
  zoom: number
): void {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const deckHeight = bridgeInfo.height;
  const trussHeight = 10;

  ctx.strokeStyle = config.color;
  ctx.lineWidth = 1.5;

  // Draw vertical members
  const numMembers = 3;
  for (let i = 0; i < numMembers; i++) {
    const t = i / (numMembers - 1);

    // Left side vertical
    const lx = x + w * 0.15 + (x + w * 0.35 - x - w * 0.15) * t;
    const ly = y + h * 0.35 + (y + h * 0.85 - y - h * 0.35) * t - deckHeight;

    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(lx, ly - trussHeight);
    ctx.stroke();

    // Right side vertical
    const rx = x + w * 0.65 + (x + w * 0.85 - x - w * 0.65) * t;
    const ry = y + h * 0.15 + (y + h * 0.65 - y - h * 0.15) * t - deckHeight;

    ctx.beginPath();
    ctx.moveTo(rx, ry);
    ctx.lineTo(rx, ry - trussHeight);
    ctx.stroke();
  }

  // Top horizontal beams
  ctx.lineWidth = 2;

  // Left beam
  ctx.beginPath();
  ctx.moveTo(x + w * 0.15, y + h * 0.35 - deckHeight - trussHeight);
  ctx.lineTo(x + w * 0.35, y + h * 0.85 - deckHeight - trussHeight);
  ctx.stroke();

  // Right beam
  ctx.beginPath();
  ctx.moveTo(x + w * 0.65, y + h * 0.15 - deckHeight - trussHeight);
  ctx.lineTo(x + w * 0.85, y + h * 0.65 - deckHeight - trussHeight);
  ctx.stroke();

  // Diagonal bracing
  if (zoom >= 0.6) {
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = config.secondaryColor;

    for (let i = 0; i < numMembers - 1; i++) {
      const t1 = i / (numMembers - 1);
      const t2 = (i + 1) / (numMembers - 1);

      // Left diagonals
      const lx1 = x + w * 0.15 + (x + w * 0.35 - x - w * 0.15) * t1;
      const ly1 = y + h * 0.35 + (y + h * 0.85 - y - h * 0.35) * t1 - deckHeight;
      const lx2 = x + w * 0.15 + (x + w * 0.35 - x - w * 0.15) * t2;
      const ly2 = y + h * 0.35 + (y + h * 0.85 - y - h * 0.35) * t2 - deckHeight - trussHeight;

      ctx.beginPath();
      ctx.moveTo(lx1, ly1);
      ctx.lineTo(lx2, ly2);
      ctx.stroke();
    }
  }
}

/**
 * Draw arch bridge supports
 */
function drawArchSupports(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  bridgeInfo: BridgeInfo,
  config: typeof BRIDGE_TYPE_CONFIG[BridgeType],
  zoom: number
): void {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const deckHeight = bridgeInfo.height;

  // Draw decorative arch below deck
  ctx.strokeStyle = config.color;
  ctx.lineWidth = 3;

  // Calculate arch position based on position in bridge span
  const archProgress = bridgeInfo.position / Math.max(1, bridgeInfo.span - 1);
  const archHeight = Math.sin(archProgress * Math.PI) * 8;

  const centerX = x + w / 2;
  const centerY = y + h / 2;

  // Draw arch curve
  ctx.beginPath();
  ctx.moveTo(x + w * 0.2, centerY + archHeight);
  ctx.quadraticCurveTo(centerX, centerY + archHeight + 6, x + w * 0.8, centerY + archHeight);
  ctx.stroke();

  // Arch support columns at ends
  if (bridgeInfo.position === 0 || bridgeInfo.position === bridgeInfo.span - 1) {
    ctx.fillStyle = config.supportsColor;
    ctx.fillRect(x + w * 0.18, centerY, 6, 10);
    ctx.fillRect(x + w * 0.76, centerY, 6, 10);
  }
}

/**
 * Draw cable-stayed bridge structure
 */
function drawCableStayed(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  bridgeInfo: BridgeInfo,
  config: typeof BRIDGE_TYPE_CONFIG[BridgeType],
  zoom: number
): void {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const deckHeight = bridgeInfo.height;

  // Only draw towers at specific positions
  const isTowerPosition = bridgeInfo.position === 0 ||
    bridgeInfo.position === bridgeInfo.span - 1 ||
    (bridgeInfo.span > 5 && bridgeInfo.position === Math.floor(bridgeInfo.span / 2));

  const towerHeight = bridgeInfo.bridgeType === 'golden_gate' ? 35 :
    bridgeInfo.bridgeType === 'suspension_bridge' ? 28 : 22;

  // Draw cables from this tile
  ctx.strokeStyle = bridgeInfo.bridgeType === 'golden_gate' ? '#8B0000' : config.secondaryColor;
  ctx.lineWidth = bridgeInfo.bridgeType === 'golden_gate' ? 2 : 1;

  if (isTowerPosition) {
    const towerX = x + w / 2;
    const towerBaseY = y + h / 2 - deckHeight;

    // Draw tower
    ctx.fillStyle = config.color;
    ctx.strokeStyle = config.supportsColor;
    ctx.lineWidth = 1;

    // Tower body - narrower at top
    ctx.beginPath();
    ctx.moveTo(towerX - 5, towerBaseY);
    ctx.lineTo(towerX + 5, towerBaseY);
    ctx.lineTo(towerX + 3, towerBaseY - towerHeight);
    ctx.lineTo(towerX - 3, towerBaseY - towerHeight);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Tower cross beam (for golden gate style)
    if (bridgeInfo.bridgeType === 'golden_gate' && zoom >= 0.5) {
      ctx.fillStyle = config.color;
      ctx.fillRect(towerX - 6, towerBaseY - towerHeight * 0.7, 12, 3);
    }

    // Draw main cables
    ctx.strokeStyle = bridgeInfo.bridgeType === 'golden_gate' ? '#8B0000' : '#555';
    ctx.lineWidth = bridgeInfo.bridgeType === 'golden_gate' ? 2.5 : 1.5;

    // Cables going to the right
    ctx.beginPath();
    ctx.moveTo(towerX, towerBaseY - towerHeight);
    ctx.lineTo(x + w, y + h / 2 - deckHeight);
    ctx.stroke();

    // Cables going to the left
    ctx.beginPath();
    ctx.moveTo(towerX, towerBaseY - towerHeight);
    ctx.lineTo(x, y + h / 2 - deckHeight);
    ctx.stroke();
  } else {
    // Draw vertical suspender cables for non-tower positions
    if (zoom >= 0.5 && bridgeInfo.bridgeType !== 'cable_stayed') {
      ctx.strokeStyle = '#888';
      ctx.lineWidth = 0.5;

      const numSuspenders = 2;
      for (let i = 0; i < numSuspenders; i++) {
        const t = (i + 1) / (numSuspenders + 1);
        const sx = x + w * t;
        const sy = y + h / 2 - deckHeight;

        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx, sy - 15 - Math.random() * 5);
        ctx.stroke();
      }
    }
  }
}

// ============================================================================
// Bridge Vehicle Rendering
// ============================================================================

/**
 * Get the deck height offset for a bridge at a specific tile
 * Used to position vehicles correctly on bridges
 */
export function getBridgeDeckOffset(bridgeInfo: BridgeInfo): number {
  return bridgeInfo.height;
}

/**
 * Check if a tile is a bridge tile
 */
export function isBridgeTile(tile: Tile): boolean {
  return tile.building.type === 'road' && tile.building.bridgeInfo !== undefined;
}

/**
 * Get bridge rendering info for a tile (if it's a bridge)
 */
export function getBridgeRenderInfo(tile: Tile): BridgeInfo | null {
  if (!isBridgeTile(tile)) return null;
  return tile.building.bridgeInfo || null;
}
