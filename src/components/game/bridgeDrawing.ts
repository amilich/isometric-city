/**
 * Bridge Drawing System - Renders isometric bridges with detailed 3D graphics
 * Extracted from CanvasIsometricGrid for better maintainability
 */

import { TILE_WIDTH, TILE_HEIGHT } from './types';
import { Building } from '@/types/game';
import { ROAD_COLORS } from './trafficSystem';
import { RAIL_COLORS } from './railSystem';

// ============================================================================
// Types
// ============================================================================

/** Bridge style configuration for rendering */
export interface BridgeStyle {
  asphalt: string;
  barrier: string;
  accent: string;
  support: string;
  cable?: string;
}

/** Bridge edge geometry for rendering */
export interface BridgeEdges {
  northEdge: { x: number; y: number };
  eastEdge: { x: number; y: number };
  southEdge: { x: number; y: number };
  westEdge: { x: number; y: number };
  startEdge: { x: number; y: number };
  endEdge: { x: number; y: number };
  perpX: number;
  perpY: number;
  neDirX: number;
  neDirY: number;
  nwDirX: number;
  nwDirY: number;
}

// ============================================================================
// Bridge Style Constants
// ============================================================================

/**
 * Bridge styles by type and variant
 * Each bridge type has multiple visual variants with different color schemes
 */
export const BRIDGE_STYLES: Record<string, BridgeStyle[]> = {
  small: [
    { asphalt: ROAD_COLORS.ASPHALT, barrier: '#707070', accent: '#606060', support: '#404040' },
    { asphalt: '#454545', barrier: '#606060', accent: '#555555', support: '#353535' },
    { asphalt: '#3d3d3d', barrier: '#585858', accent: '#484848', support: '#303030' },
  ],
  medium: [
    { asphalt: ROAD_COLORS.ASPHALT, barrier: '#808080', accent: '#707070', support: '#505050' },
    { asphalt: '#454545', barrier: '#707070', accent: '#606060', support: '#454545' },
    { asphalt: '#3d3d3d', barrier: '#656565', accent: '#555555', support: '#404040' },
  ],
  large: [
    { asphalt: '#3d3d3d', barrier: '#4682B4', accent: '#5a8a8a', support: '#3a5a5a' },
    { asphalt: ROAD_COLORS.ASPHALT, barrier: '#708090', accent: '#607080', support: '#405060' },
  ],
  suspension: [
    { asphalt: '#3d3d3d', barrier: '#707070', accent: '#606060', support: '#909090', cable: '#DC143C' },  // Classic red
    { asphalt: '#3d3d3d', barrier: '#606060', accent: '#555555', support: '#808080', cable: '#708090' },  // Steel grey
    { asphalt: '#3d3d3d', barrier: '#656560', accent: '#555550', support: '#858580', cable: '#5a7a5a' },  // Weathered green/rust
  ],
};

// ============================================================================
// Bridge Geometry Helpers
// ============================================================================

/**
 * Get the bridge style for a given bridge type and variant
 */
export function getBridgeStyle(bridgeType: string, variant: number): BridgeStyle {
  return BRIDGE_STYLES[bridgeType]?.[variant] || BRIDGE_STYLES.large[0];
}

/**
 * Get the deck fill color for a bridge (different for rail vs road)
 */
export function getBridgeDeckColor(isRailBridge: boolean, style: BridgeStyle): string {
  return isRailBridge ? RAIL_COLORS.BRIDGE_DECK : style.asphalt;
}

/**
 * Calculate bridge geometry for rendering
 * Returns edge points and perpendicular vectors for drawing the bridge
 */
export function calculateBridgeEdges(
  x: number,
  y: number,
  adjustedY: number,
  orientation: 'ns' | 'ew'
): BridgeEdges {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  
  // Edge points - use adjustedY for rail bridges vertical offset
  const northEdge = { x: x + w * 0.25, y: adjustedY + h * 0.25 };
  const eastEdge = { x: x + w * 0.75, y: adjustedY + h * 0.25 };
  const southEdge = { x: x + w * 0.75, y: adjustedY + h * 0.75 };
  const westEdge = { x: x + w * 0.25, y: adjustedY + h * 0.75 };
  
  // Isometric tile edge direction vectors (normalized)
  const neEdgeLen = Math.hypot(w / 2, h / 2);
  const neDirX = (w / 2) / neEdgeLen;
  const neDirY = (h / 2) / neEdgeLen;
  const nwDirX = -(w / 2) / neEdgeLen;
  const nwDirY = (h / 2) / neEdgeLen;
  
  let startEdge: { x: number; y: number };
  let endEdge: { x: number; y: number };
  let perpX: number;
  let perpY: number;
  
  if (orientation === 'ns') {
    startEdge = { x: northEdge.x, y: northEdge.y };
    endEdge = { x: southEdge.x, y: southEdge.y };
    perpX = nwDirX;
    perpY = nwDirY;
  } else {
    startEdge = { x: eastEdge.x, y: eastEdge.y };
    endEdge = { x: westEdge.x, y: westEdge.y };
    perpX = neDirX;
    perpY = neDirY;
  }
  
  return {
    northEdge,
    eastEdge,
    southEdge,
    westEdge,
    startEdge,
    endEdge,
    perpX,
    perpY,
    neDirX,
    neDirY,
    nwDirX,
    nwDirY,
  };
}

/**
 * Calculate bridge width ratio based on whether it's a rail or road bridge
 */
export function getBridgeWidthRatio(isRailBridge: boolean): number {
  return isRailBridge ? 0.36 : 0.45;
}

/**
 * Get the Y offset for rail bridges (they're shifted down slightly)
 */
export function getRailBridgeYOffset(isRailBridge: boolean): number {
  return isRailBridge ? TILE_HEIGHT * 0.1 : 0;
}

/**
 * Parse building properties for bridge rendering
 */
export function parseBridgeProperties(building: Building) {
  const bridgeType = building.bridgeType || 'large';
  const orientation = (building.bridgeOrientation || 'ns') as 'ns' | 'ew';
  const variant = building.bridgeVariant || 0;
  const position = building.bridgePosition || 'middle';
  const bridgeIndex = building.bridgeIndex ?? 0;
  const bridgeSpan = building.bridgeSpan ?? 1;
  const trackType = building.bridgeTrackType || 'road';
  const isRailBridge = trackType === 'rail';
  
  return {
    bridgeType,
    orientation,
    variant,
    position,
    bridgeIndex,
    bridgeSpan,
    trackType,
    isRailBridge,
  };
}

// ============================================================================
// Pillar Drawing
// ============================================================================

/**
 * Draw a 3D isometric support pillar
 */
export function drawPillar(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  pillarW: number,
  pillarH: number,
  supportColor: string
): void {
  // Draw the side face first (darker concrete)
  ctx.fillStyle = '#606060';
  ctx.beginPath();
  ctx.moveTo(px - pillarW, py);
  ctx.lineTo(px - pillarW, py + pillarH);
  ctx.lineTo(px, py + pillarH + pillarW / 2);
  ctx.lineTo(px, py + pillarW / 2);
  ctx.closePath();
  ctx.fill();
  
  // Draw the front face (lighter concrete)
  ctx.fillStyle = '#787878';
  ctx.beginPath();
  ctx.moveTo(px, py + pillarW / 2);
  ctx.lineTo(px, py + pillarH + pillarW / 2);
  ctx.lineTo(px + pillarW, py + pillarH);
  ctx.lineTo(px + pillarW, py);
  ctx.closePath();
  ctx.fill();
  
  // Draw the top face
  ctx.fillStyle = supportColor;
  ctx.beginPath();
  ctx.moveTo(px, py - pillarW / 2);
  ctx.lineTo(px + pillarW, py);
  ctx.lineTo(px, py + pillarW / 2);
  ctx.lineTo(px - pillarW, py);
  ctx.closePath();
  ctx.fill();
}

// ============================================================================
// Suspension Tower Drawing  
// ============================================================================

/**
 * Draw a 3D isometric suspension bridge tower
 */
export function drawSuspensionTower(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  towerW: number,
  towerH: number,
  color: string
): void {
  // Draw back column (left)
  ctx.fillStyle = color;
  ctx.fillRect(px - towerW * 0.6, py - towerH, towerW * 0.4, towerH);
  
  // Draw front column (right)
  ctx.fillRect(px + towerW * 0.2, py - towerH, towerW * 0.4, towerH);
  
  // Draw crossbeam at top
  ctx.fillRect(px - towerW * 0.6, py - towerH, towerW * 1.2, towerW * 0.4);
  
  // Add 3D shading to front column
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.fillRect(px + towerW * 0.2, py - towerH, towerW * 0.15, towerH);
  
  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.fillRect(px + towerW * 0.45, py - towerH, towerW * 0.15, towerH);
}
