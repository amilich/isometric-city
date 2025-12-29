/**
 * Bridge Drawing System - Renders isometric bridges with detailed 3D graphics
 * Extracted from CanvasIsometricGrid for better maintainability
 */

import { TILE_WIDTH, TILE_HEIGHT } from './types';
import { Building } from '@/types/game';
import { ROAD_COLORS } from './trafficSystem';
import { RAIL_COLORS, TRACK_GAUGE_RATIO, TRACK_SEPARATION_RATIO } from './railSystem';

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

// ============================================================================
// Bridge Tile Drawing Functions
// Extracted from CanvasIsometricGrid for better maintainability
// ============================================================================

/**
 * Draw a complete bridge tile as a SINGLE continuous shape to avoid gaps
 */
export function drawBridgeTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  building: Building,
  gridX: number,
  gridY: number,
  currentZoom: number
): void {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  
  // Parse bridge properties using extracted helper
  const {
    bridgeType,
    orientation,
    variant,
    position,
    bridgeIndex,
    bridgeSpan,
    isRailBridge,
  } = parseBridgeProperties(building);
  
  // Get style from extracted constants
  const style = getBridgeStyle(bridgeType, variant);
  
  // Rail bridges are shifted down slightly on the Y axis
  const yOffset = getRailBridgeYOffset(isRailBridge);
  const adjustedY = y + yOffset;
  
  const cx = x + w / 2;
  const cy = adjustedY + h / 2;
  
  // Bridge width - rail bridges are 20% skinnier than road bridges
  const bridgeWidthRatio = getBridgeWidthRatio(isRailBridge);
  const halfWidth = w * bridgeWidthRatio * 0.5;
  
  // Calculate bridge edge geometry using extracted helper
  const edges = calculateBridgeEdges(x, y, adjustedY, orientation);
  const { startEdge, endEdge, perpX, perpY } = edges;
  
  // ============================================================
  // DRAW SUPPORT PILLARS (one per tile, at front position to avoid z-order issues)
  // ============================================================
  const pillarW = 4;
  const pillarH = 14; 
  
  // Only draw pillar on every other tile to reduce count, and place at back position (0.35)
  // Water tiles toward startEdge are rendered BEFORE this bridge tile, so pillar won't be covered
  // Suspension bridges don't need base pillars - they have tower supports instead
  const shouldDrawPillar = bridgeType !== 'suspension' && ((bridgeIndex % 2 === 0) || position === 'start' || position === 'end');
  
  if (shouldDrawPillar) {
    // Place pillar toward the "start" edge (back in render order) - water there is already drawn
    const pillarT = 0.35; // Position along the tile (0.35 = toward start/back)
    const pillarPos = {
      x: startEdge.x + (endEdge.x - startEdge.x) * pillarT,
      y: startEdge.y + (endEdge.y - startEdge.y) * pillarT
    };
    
    // Use extracted pillar drawing function
    drawPillar(ctx, pillarPos.x, pillarPos.y, pillarW, pillarH, style.support);
  }
  
  // ============================================================
  // DRAW ROAD CONNECTOR AT BRIDGE ENDS (covers road centerline and fills gap)
  // ============================================================
  // At the start/end of a bridge, we need to draw a road segment that:
  // 1. Fills the gap between the road and the elevated bridge deck
  // 2. Covers up the yellow centerline from the adjacent road
  
  const deckElevation = 3;
  
  // Travel direction for connector extension
  const dx = endEdge.x - startEdge.x;
  const dy = endEdge.y - startEdge.y;
  const travelLen = Math.hypot(dx, dy);
  const travelDirX = dx / travelLen;
  const travelDirY = dy / travelLen;
  
  // Calculate how far to extend beyond the bridge tile (to cover the road's centerline)
  const extensionAmount = 8; // Extend into the road tile to cover centerline
  
  // Store connector info for drawing borders after the deck
  const connectorBordersToDraw: Array<{
    extendedX: number;
    extendedY: number;
    connectorEdgeX: number;
    connectorEdgeY: number;
  }> = [];
  
  // Helper to draw a connector fill from bridge edge to road
  const drawConnectorFill = (connectorEdge: { x: number; y: number }, extensionDir: number) => {
    // Extended edge position (going toward the adjacent road)
    const extendedX = connectorEdge.x + travelDirX * extensionAmount * extensionDir;
    const extendedY = connectorEdge.y + travelDirY * extensionAmount * extensionDir;
    
    // Draw a connector parallelogram from the extended position to the bridge edge
    // The extended end (in the road) is at ground level, the bridge end is elevated
    const connectorRoadLeft = { x: extendedX + perpX * halfWidth, y: extendedY + perpY * halfWidth };
    const connectorRoadRight = { x: extendedX - perpX * halfWidth, y: extendedY - perpY * halfWidth };
    const connectorBridgeLeft = { x: connectorEdge.x + perpX * halfWidth, y: connectorEdge.y - deckElevation + perpY * halfWidth };
    const connectorBridgeRight = { x: connectorEdge.x - perpX * halfWidth, y: connectorEdge.y - deckElevation - perpY * halfWidth };
    
    // Draw the connector (use appropriate color for road or rail)
    ctx.fillStyle = getBridgeDeckColor(isRailBridge, style);
    ctx.beginPath();
    ctx.moveTo(connectorRoadLeft.x, connectorRoadLeft.y);
    ctx.lineTo(connectorBridgeLeft.x, connectorBridgeLeft.y);
    ctx.lineTo(connectorBridgeRight.x, connectorBridgeRight.y);
    ctx.lineTo(connectorRoadRight.x, connectorRoadRight.y);
    ctx.closePath();
    ctx.fill();
    
    // Store info for drawing borders after deck
    if (!isRailBridge) {
      connectorBordersToDraw.push({
        extendedX,
        extendedY,
        connectorEdgeX: connectorEdge.x,
        connectorEdgeY: connectorEdge.y,
      });
    }
  };
  
  // Helper to draw connector borders (called after deck is drawn)
  const drawConnectorBorders = () => {
    if (isRailBridge) return;
    
    const borderInset = halfWidth * 0.22;
    const borderHalfWidth = halfWidth - borderInset;
    
    ctx.strokeStyle = '#606060'; // Lighter grey border for visibility
    ctx.lineWidth = 0.75;
    
    for (const border of connectorBordersToDraw) {
      // Road-side border (at extended/ground level end)
      ctx.beginPath();
      ctx.moveTo(border.extendedX + perpX * borderHalfWidth, border.extendedY + perpY * borderHalfWidth);
      ctx.lineTo(border.extendedX - perpX * borderHalfWidth, border.extendedY - perpY * borderHalfWidth);
      ctx.stroke();
      
      // Bridge-side border (at elevated end)
      ctx.beginPath();
      ctx.moveTo(border.connectorEdgeX + perpX * borderHalfWidth, border.connectorEdgeY - deckElevation + perpY * borderHalfWidth);
      ctx.lineTo(border.connectorEdgeX - perpX * borderHalfWidth, border.connectorEdgeY - deckElevation - perpY * borderHalfWidth);
      ctx.stroke();
    }
  };
  
  // For 1x1 bridges (span of 1), draw connectors on BOTH ends
  // SKIP connectors for rail bridges - they don't need road-style ramps
  const isSingleTileBridge = bridgeSpan === 1;
  
  if (!isRailBridge) {
    if (position === 'start' || isSingleTileBridge) {
      // Draw connector fill at start edge (extending backward)
      drawConnectorFill(startEdge, -1);
    }
    
    if (position === 'end' || isSingleTileBridge) {
      // Draw connector fill at end edge (extending forward)
      drawConnectorFill(endEdge, 1);
    }
  }
  
  // ============================================================
  // DRAW BRIDGE DECK AS SINGLE CONTINUOUS SHAPE
  // ============================================================
  
  // For rail bridges, extend the deck slightly in the travel direction to close gaps between tiles
  // This compensates for sub-pixel rendering issues with the narrower rail bridge deck
  const railGapFix = isRailBridge ? 1.5 : 0;
  const extendedStartEdge = {
    x: startEdge.x - travelDirX * railGapFix,
    y: startEdge.y - travelDirY * railGapFix
  };
  const extendedEndEdge = {
    x: endEdge.x + travelDirX * railGapFix,
    y: endEdge.y + travelDirY * railGapFix
  };
  
  // The deck is elevated uniformly above water
  const startY = extendedStartEdge.y - deckElevation;
  const endY = extendedEndEdge.y - deckElevation;
  
  // Use perpendicular direction (90° CCW of travel) for deck corners
  // This matches how roads compute their perpendicular using getPerp() for proper alignment
  // perpX and perpY were computed earlier using the bridge direction
  
  // Pre-compute deck corners for deck drawing (uses isometric-aligned perpendicular)
  const startLeft = { x: extendedStartEdge.x + perpX * halfWidth, y: startY + perpY * halfWidth };
  const startRight = { x: extendedStartEdge.x - perpX * halfWidth, y: startY - perpY * halfWidth };
  const endLeft = { x: extendedEndEdge.x + perpX * halfWidth, y: endY + perpY * halfWidth };
  const endRight = { x: extendedEndEdge.x - perpX * halfWidth, y: endY - perpY * halfWidth };
  
  // Draw suspension bridge towers BEFORE the deck so deck appears on top
  if (bridgeType === 'suspension' && currentZoom >= 0.5) {
    // Tower perpendicular (true 90°)
    const tDx = endEdge.x - startEdge.x;
    const tDy = endEdge.y - startEdge.y;
    const tTravelLen = Math.hypot(tDx, tDy);
    const towerPerpX = -tDy / tTravelLen;
    const towerPerpY = tDx / tTravelLen;
    
    // Tower dimensions and positions
    const suspTowerW = 3;
    const suspTowerH = 27;
    const suspTowerSpacing = w * 0.45;
    const backTowerYOff = -5;
    const frontTowerYOff = 8;
    
    const leftTowerX = cx + towerPerpX * suspTowerSpacing;
    const leftTowerY = cy + towerPerpY * suspTowerSpacing;
    const rightTowerX = cx - towerPerpX * suspTowerSpacing;
    const rightTowerY = cy - towerPerpY * suspTowerSpacing;
    
    const backTower = leftTowerY < rightTowerY 
      ? { x: leftTowerX, y: leftTowerY } 
      : { x: rightTowerX, y: rightTowerY };
    const frontTower = leftTowerY < rightTowerY 
      ? { x: rightTowerX, y: rightTowerY } 
      : { x: leftTowerX, y: leftTowerY };
    
    // Check if this is a middle tower tile
    const middleIdx = Math.floor((bridgeSpan - 1) / 2);
    const hasSpan = building.bridgeSpan !== undefined && building.bridgeSpan > 1;
    const isMiddleTower = position === 'middle' && (
      (hasSpan && bridgeSpan > 6 && bridgeIndex === middleIdx) ||
      (!hasSpan && ((x / w + adjustedY / h) % 5 === 2))
    );
    
    // Only draw on start/end tiles or middle tower tiles
    if (position === 'start' || position === 'end' || isMiddleTower) {
      // Style - 3 variants
      const supportColors = ['#909090', '#808080', '#858580'];
      const baseColors = ['#606060', '#555555', '#555550'];
      const safeVar = variant % 3;
      const supportCol = supportColors[safeVar];
      const baseCol = baseColors[safeVar];
      
      // Tower dimensions
      const towerH = suspTowerH + 8;
      const baseH = 6;
      const baseW = suspTowerW + 2;
      
      // Draw back tower - shorter and no base
      const backTowerH = 15; // Shorter to avoid intersecting roads
      const backTowerShiftUp = 2.5; // Small shift up
      ctx.fillStyle = supportCol;
      ctx.fillRect(
        backTower.x - suspTowerW/2, 
        cy - backTowerH + backTowerYOff - backTowerShiftUp, 
        suspTowerW, 
        backTowerH
      );
      
      // Draw front tower with concrete base
      ctx.fillStyle = baseCol;
      ctx.fillRect(
        frontTower.x - baseW/2, 
        cy - suspTowerH + frontTowerYOff + towerH - baseH, 
        baseW, 
        baseH
      );
      ctx.fillStyle = supportCol;
      ctx.fillRect(
        frontTower.x - suspTowerW/2, 
        cy - suspTowerH + frontTowerYOff, 
        suspTowerW, 
        towerH - baseH
      );
    }
  }
  
  // Draw the deck as a parallelogram with tile-edge-aligned sides
  // Rail bridges use metallic steel color, road bridges use asphalt
  ctx.fillStyle = getBridgeDeckColor(isRailBridge, style);
  ctx.beginPath();
  ctx.moveTo(startLeft.x, startLeft.y);
  ctx.lineTo(endLeft.x, endLeft.y);
  ctx.lineTo(endRight.x, endRight.y);
  ctx.lineTo(startRight.x, startRight.y);
  ctx.closePath();
  ctx.fill();
  
  // ============================================================
  // BRIDGE BARRIERS (railings on both sides)
  // ============================================================
  if (currentZoom >= 0.4) {
    const barrierW = 2;
    ctx.fillStyle = style.barrier;
    
    // Left barrier (using perpendicular direction for proper alignment)
    const startLeftOuter = { x: extendedStartEdge.x + perpX * (halfWidth + barrierW), y: startY + perpY * (halfWidth + barrierW) };
    const endLeftOuter = { x: extendedEndEdge.x + perpX * (halfWidth + barrierW), y: endY + perpY * (halfWidth + barrierW) };
    ctx.beginPath();
    ctx.moveTo(startLeft.x, startLeft.y);
    ctx.lineTo(endLeft.x, endLeft.y);
    ctx.lineTo(endLeftOuter.x, endLeftOuter.y);
    ctx.lineTo(startLeftOuter.x, startLeftOuter.y);
    ctx.closePath();
    ctx.fill();
    
    // Right barrier  
    const startRightOuter = { x: extendedStartEdge.x - perpX * (halfWidth + barrierW), y: startY - perpY * (halfWidth + barrierW) };
    const endRightOuter = { x: extendedEndEdge.x - perpX * (halfWidth + barrierW), y: endY - perpY * (halfWidth + barrierW) };
    ctx.beginPath();
    ctx.moveTo(startRight.x, startRight.y);
    ctx.lineTo(endRight.x, endRight.y);
    ctx.lineTo(endRightOuter.x, endRightOuter.y);
    ctx.lineTo(startRightOuter.x, startRightOuter.y);
    ctx.closePath();
    ctx.fill();
  }
  
  // ============================================================
  // LANE MARKINGS (road) or RAIL TRACKS (rail)
  // ============================================================
  if (isRailBridge) {
    // Draw rail tracks on rail bridge - DOUBLE TRACKS matching railSystem.ts
    if (currentZoom >= 0.4) {
      const railGauge = w * TRACK_GAUGE_RATIO;
      const halfGauge = railGauge / 2;
      const trackSep = w * TRACK_SEPARATION_RATIO;
      const halfSep = trackSep / 2;
      const railWidth = currentZoom >= 0.7 ? 0.85 : 0.7;
      
      // Draw ties (metal/treated wood sleepers on bridge) for both tracks
      ctx.strokeStyle = RAIL_COLORS.BRIDGE_TIE;
      ctx.lineWidth = 1;
      ctx.lineCap = 'butt';
      
      const numTies = 7; // Match TIES_PER_TILE
      const tieHalfLen = w * 0.065; // Half-length of each tie
      
      // Use original (non-extended) edges for ties to align with adjacent rail tiles
      // The extended edges are only for the deck/rails to avoid sub-pixel gaps
      const tieStartY = startEdge.y - deckElevation;
      const tieEndY = endEdge.y - deckElevation;
      
      for (const trackOffset of [halfSep, -halfSep]) {
        // Track center line - use original edges for tie alignment with adjacent tiles
        const trackStartX = startEdge.x + perpX * trackOffset;
        const trackStartY = tieStartY + perpY * trackOffset;
        const trackEndX = endEdge.x + perpX * trackOffset;
        const trackEndY = tieEndY + perpY * trackOffset;
        
        // Match railSystem.ts: use (i + 0.5) / numTies to center ties, avoiding edge overlap
        for (let i = 0; i < numTies; i++) {
          const t = (i + 0.5) / numTies;
          const tieX = trackStartX + (trackEndX - trackStartX) * t;
          const tieY = trackStartY + (trackEndY - trackStartY) * t;
          
          ctx.beginPath();
          ctx.moveTo(tieX + perpX * tieHalfLen, tieY + perpY * tieHalfLen);
          ctx.lineTo(tieX - perpX * tieHalfLen, tieY - perpY * tieHalfLen);
          ctx.stroke();
        }
      }
      
      // Draw rails (4 rails total - 2 per track)
      // Draw shadow first, then rails on top
      for (const trackOffset of [halfSep, -halfSep]) {
        // Use extended edges to match bridge deck alignment
        const trackStartX = extendedStartEdge.x + perpX * trackOffset;
        const trackStartY = startY + perpY * trackOffset;
        const trackEndX = extendedEndEdge.x + perpX * trackOffset;
        const trackEndY = endY + perpY * trackOffset;
        
        // Rail shadows
        ctx.strokeStyle = RAIL_COLORS.RAIL_SHADOW;
        ctx.lineWidth = railWidth + 0.3;
        ctx.lineCap = 'round';
        
        // Left rail shadow
        ctx.beginPath();
        ctx.moveTo(trackStartX + perpX * halfGauge + 0.3, trackStartY + perpY * halfGauge + 0.3);
        ctx.lineTo(trackEndX + perpX * halfGauge + 0.3, trackEndY + perpY * halfGauge + 0.3);
        ctx.stroke();
        
        // Right rail shadow
        ctx.beginPath();
        ctx.moveTo(trackStartX - perpX * halfGauge + 0.3, trackStartY - perpY * halfGauge + 0.3);
        ctx.lineTo(trackEndX - perpX * halfGauge + 0.3, trackEndY - perpY * halfGauge + 0.3);
        ctx.stroke();
        
        // Rails
        ctx.strokeStyle = RAIL_COLORS.RAIL;
        ctx.lineWidth = railWidth;
        
        // Left rail
        ctx.beginPath();
        ctx.moveTo(trackStartX + perpX * halfGauge, trackStartY + perpY * halfGauge);
        ctx.lineTo(trackEndX + perpX * halfGauge, trackEndY + perpY * halfGauge);
        ctx.stroke();
        
        // Right rail
        ctx.beginPath();
        ctx.moveTo(trackStartX - perpX * halfGauge, trackStartY - perpY * halfGauge);
        ctx.lineTo(trackEndX - perpX * halfGauge, trackEndY - perpY * halfGauge);
        ctx.stroke();
      }
    }
  } else {
    // Draw lane markings for road bridge
    if (currentZoom >= 0.6) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 0.5; // Half as wide as before (was 1)
      ctx.setLineDash([1.5, 2]); // 2x more frequent (was [4, 6])
      ctx.lineCap = 'round';
      
      // Calculate dash offset to align dashes across bridge tiles
      // Use grid position to create consistent offset
      const travelDx = endEdge.x - startEdge.x;
      const travelDy = endEdge.y - startEdge.y;
      
      // Create offset based on tile position to align dashes across tiles
      // Use a combination of grid coordinates to create unique but consistent offset
      const offsetBase = (gridX * 17 + gridY * 23) % 100; // Pseudo-random but consistent per tile
      const dashPatternLength = 1.5 + 2; // Total length of one dash cycle
      const dashOffset = (offsetBase / 100) * dashPatternLength;
      
      ctx.setLineDash([1.5, 2]);
      ctx.lineDashOffset = -dashOffset;
      
      ctx.beginPath();
      ctx.moveTo(startEdge.x, startY);
      ctx.lineTo(endEdge.x, endY);
      ctx.stroke();
      
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;
      ctx.lineCap = 'butt';
    }
  }
  
  // ============================================================
  // BRIDGE TYPE-SPECIFIC DECORATIONS
  // ============================================================
  
  // NOTE: Suspension bridge front tower and cables are now drawn in drawSuspensionBridgeOverlay
  // which is called after buildings for proper z-ordering
  
  // Large bridge truss structure (skip for rail bridges and 1-tile bridges)
  if (bridgeType === 'large' && currentZoom >= 0.5 && !isRailBridge && bridgeSpan > 1) {
    ctx.strokeStyle = style.accent;
    ctx.lineWidth = 1.5;
    const trussHLeft = 3;
    const trussHRight = 5;
    
    // Top beams on both sides (using tile-edge-aligned direction)
    ctx.beginPath();
    ctx.moveTo(startLeft.x, startLeft.y - trussHLeft);
    ctx.lineTo(endLeft.x, endLeft.y - trussHLeft);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(startRight.x, startRight.y - trussHRight);
    ctx.lineTo(endRight.x, endRight.y - trussHRight);
    ctx.stroke();
    
    // Vertical supports
    for (let i = 0; i <= 4; i++) {
      const t = i / 4;
      const leftX = startLeft.x + (endLeft.x - startLeft.x) * t;
      const leftY = startLeft.y + (endLeft.y - startLeft.y) * t;
      const rightX = startRight.x + (endRight.x - startRight.x) * t;
      const rightY = startRight.y + (endRight.y - startRight.y) * t;
      
      ctx.beginPath();
      ctx.moveTo(leftX, leftY);
      ctx.lineTo(leftX, leftY - trussHLeft);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(rightX, rightY);
      ctx.lineTo(rightX, rightY - trussHRight);
      ctx.stroke();
    }
  }
  
  // ============================================================
  // DRAW CONNECTOR BORDERS (after deck so they're on top)
  // ============================================================
  drawConnectorBorders();
}

/**
 * Draw suspension bridge towers on main canvas (after base tiles, before buildings canvas)
 * This ensures towers appear above base tiles but below the buildings canvas
 */
export function drawSuspensionBridgeTowers(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  building: Building,
  currentZoom: number
): void {
  if (building.bridgeType !== 'suspension' || currentZoom < 0.5) return;
  
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  
  const orientation = building.bridgeOrientation || 'ns';
  const variant = building.bridgeVariant || 0;
  const position = building.bridgePosition || 'middle';
  const bridgeIndex = building.bridgeIndex ?? 0;
  const bridgeSpan = building.bridgeSpan ?? 1;
  const trackType = building.bridgeTrackType || 'road';
  const isRailBridge = trackType === 'rail';
  
  // Rail bridges are shifted down - match the offset from drawBridgeTile
  const yOffset = isRailBridge ? h * 0.1 : 0;
  const adjustedY = y + yOffset;
  
  const cx = x + w / 2;
  const cy = adjustedY + h / 2;
  
  // Edge points - use adjustedY for rail bridges
  const northEdge = { x: x + w * 0.25, y: adjustedY + h * 0.25 };
  const eastEdge = { x: x + w * 0.75, y: adjustedY + h * 0.25 };
  const southEdge = { x: x + w * 0.75, y: adjustedY + h * 0.75 };
  const westEdge = { x: x + w * 0.25, y: adjustedY + h * 0.75 };
  
  let startEdge: { x: number; y: number };
  let endEdge: { x: number; y: number };
  
  if (orientation === 'ns') {
    startEdge = northEdge;
    endEdge = southEdge;
  } else {
    startEdge = eastEdge;
    endEdge = westEdge;
  }
  
  // Tower perpendicular (true 90°)
  const dx = endEdge.x - startEdge.x;
  const dy = endEdge.y - startEdge.y;
  const travelLen = Math.hypot(dx, dy);
  const towerPerpX = -dy / travelLen;
  const towerPerpY = dx / travelLen;
  
  // Tower dimensions and positions
  const suspTowerW = 3;
  const suspTowerH = 27;
  const suspTowerSpacing = w * 0.45;
  const backTowerYOffset = -5;
  const frontTowerYOffset = 8;
  
  const leftTowerX = cx + towerPerpX * suspTowerSpacing;
  const leftTowerY = cy + towerPerpY * suspTowerSpacing;
  const rightTowerX = cx - towerPerpX * suspTowerSpacing;
  const rightTowerY = cy - towerPerpY * suspTowerSpacing;
  
  const backTower = leftTowerY < rightTowerY 
    ? { x: leftTowerX, y: leftTowerY } 
    : { x: rightTowerX, y: rightTowerY };
  const frontTower = leftTowerY < rightTowerY 
    ? { x: rightTowerX, y: rightTowerY } 
    : { x: leftTowerX, y: leftTowerY };
  
  // Check if this is a middle tower tile
  const middleIndex = Math.floor((bridgeSpan - 1) / 2);
  const hasSpanInfo = building.bridgeSpan !== undefined && building.bridgeSpan > 1;
  const isMiddleTowerTile = position === 'middle' && (
    (hasSpanInfo && bridgeSpan > 6 && bridgeIndex === middleIndex) ||
    (!hasSpanInfo && ((x / w + adjustedY / h) % 5 === 2))
  );
  
  // Only draw on start/end tiles or middle tower tiles
  if (position !== 'start' && position !== 'end' && !isMiddleTowerTile) return;
  
  // Style - 3 variants
  const supportColors = ['#909090', '#808080', '#858580'];
  const baseColors = ['#606060', '#555555', '#555550'];
  const safeVariant = variant % 3;
  const supportColor = supportColors[safeVariant];
  const baseColor = baseColors[safeVariant];
  
  // Tower dimensions
  const towerHeight = suspTowerH + 8;
  const baseHeight = 6;
  const baseWidth = suspTowerW + 2;
  
  // Draw back tower - shorter and no base
  const backTowerHeight = 22;
  const backTowerShiftUp = 4;
  ctx.fillStyle = supportColor;
  ctx.fillRect(
    backTower.x - suspTowerW/2, 
    cy - backTowerHeight + backTowerYOffset - backTowerShiftUp, 
    suspTowerW, 
    backTowerHeight
  );
  
  // Draw front tower with concrete base
  ctx.fillStyle = baseColor;
  ctx.fillRect(
    frontTower.x - baseWidth/2, 
    cy - suspTowerH + frontTowerYOffset + towerHeight - baseHeight, 
    baseWidth, 
    baseHeight
  );
  ctx.fillStyle = supportColor;
  ctx.fillRect(
    frontTower.x - suspTowerW/2, 
    cy - suspTowerH + frontTowerYOffset, 
    suspTowerW, 
    towerHeight - baseHeight
  );
}

/**
 * Draw suspension bridge cables as an overlay (on top of buildings)
 * This is called separately after buildings are drawn for proper z-ordering
 */
export function drawSuspensionBridgeOverlay(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  building: Building,
  currentZoom: number
): void {
  if (building.bridgeType !== 'suspension' || currentZoom < 0.5) return;
  
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  
  const orientation = building.bridgeOrientation || 'ns';
  const variant = building.bridgeVariant || 0;
  const position = building.bridgePosition || 'middle';
  const bridgeIndex = building.bridgeIndex ?? 0;
  const bridgeSpan = building.bridgeSpan ?? 1;
  const trackType = building.bridgeTrackType || 'road';
  const isRailBridge = trackType === 'rail';
  
  // Rail bridges are shifted down - match the offset from drawBridgeTile
  const yOffset = isRailBridge ? h * 0.1 : 0;
  const adjustedY = y + yOffset;
  
  const cx = x + w / 2;
  const cy = adjustedY + h / 2;
  
  // Bridge width for deck positioning - match drawBridgeTile
  const bridgeWidthRatio = isRailBridge ? 0.36 : 0.45;
  const halfWidth = w * bridgeWidthRatio * 0.5;
  
  // Edge points - use adjustedY for rail bridges
  const northEdge = { x: x + w * 0.25, y: adjustedY + h * 0.25 };
  const eastEdge = { x: x + w * 0.75, y: adjustedY + h * 0.25 };
  const southEdge = { x: x + w * 0.75, y: adjustedY + h * 0.75 };
  const westEdge = { x: x + w * 0.25, y: adjustedY + h * 0.75 };
  
  // Isometric direction vectors
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
    startEdge = northEdge;
    endEdge = southEdge;
    perpX = nwDirX;
    perpY = nwDirY;
  } else {
    startEdge = eastEdge;
    endEdge = westEdge;
    perpX = neDirX;
    perpY = neDirY;
  }
  
  const deckElevation = 3;
  const startY = startEdge.y - deckElevation;
  const endY = endEdge.y - deckElevation;
  
  // Tower perpendicular (true 90°)
  const dx = endEdge.x - startEdge.x;
  const dy = endEdge.y - startEdge.y;
  const travelLen = Math.hypot(dx, dy);
  const travelDirX = dx / travelLen;
  const travelDirY = dy / travelLen;
  const towerPerpX = -dy / travelLen;
  const towerPerpY = dx / travelLen;
  
  // Deck corners for cable attachment
  const startLeft = { x: startEdge.x + perpX * halfWidth, y: startY + perpY * halfWidth };
  const startRight = { x: startEdge.x - perpX * halfWidth, y: startY - perpY * halfWidth };
  const endLeft = { x: endEdge.x + perpX * halfWidth, y: endY + perpY * halfWidth };
  const endRight = { x: endEdge.x - perpX * halfWidth, y: endY - perpY * halfWidth };
  
  // Cable attachment points
  const barrierOffset = 3;
  const cableExtension = 18;
  const cableAttachLeft = {
    startX: startLeft.x + perpX * barrierOffset - travelDirX * cableExtension,
    startY: startLeft.y + perpY * barrierOffset - travelDirY * cableExtension,
    endX: endLeft.x + perpX * barrierOffset + travelDirX * cableExtension,
    endY: endLeft.y + perpY * barrierOffset + travelDirY * cableExtension
  };
  const cableAttachRight = {
    startX: startRight.x - perpX * barrierOffset - travelDirX * cableExtension,
    startY: startRight.y - perpY * barrierOffset - travelDirY * cableExtension,
    endX: endRight.x - perpX * barrierOffset + travelDirX * cableExtension,
    endY: endRight.y - perpY * barrierOffset + travelDirY * cableExtension
  };
  
  // Tower dimensions and positions
  const suspTowerH = 27;
  const suspTowerSpacing = w * 0.45;
  const backTowerYOffset = -5;
  const frontTowerYOffset = 8;
  
  const leftTowerX = cx + towerPerpX * suspTowerSpacing;
  const leftTowerY = cy + towerPerpY * suspTowerSpacing;
  const rightTowerX = cx - towerPerpX * suspTowerSpacing;
  const rightTowerY = cy - towerPerpY * suspTowerSpacing;
  
  const backTower = leftTowerY < rightTowerY 
    ? { x: leftTowerX, y: leftTowerY } 
    : { x: rightTowerX, y: rightTowerY };
  const frontTower = leftTowerY < rightTowerY 
    ? { x: rightTowerX, y: rightTowerY } 
    : { x: leftTowerX, y: leftTowerY };
  
  // Check if this is a middle tower tile
  const middleIndex = Math.floor((bridgeSpan - 1) / 2);
  const hasSpanInfo = building.bridgeSpan !== undefined && building.bridgeSpan > 1;
  const isMiddleTowerTile = position === 'middle' && (
    (hasSpanInfo && bridgeSpan > 6 && bridgeIndex === middleIndex) ||
    (!hasSpanInfo && ((x / w + adjustedY / h) % 5 === 2))
  );
  
  // Only draw on start/end tiles or middle tower tiles
  if (position !== 'start' && position !== 'end' && !isMiddleTowerTile) return;
  
  // Style - 3 variants: red cables, grey cables, green/rust cables
  const cableColors = ['#DC143C', '#708090', '#5a7a5a'];  // Red, steel grey, weathered green
  const safeVariant = variant % 3;  // Ensure variant is in range
  const cableColor = cableColors[safeVariant];
  
  // NOTE: Towers are drawn on the main canvas (via drawSuspensionBridgeTowers) 
  // so they appear below the bridge deck but above base tiles
  
  // Draw cables only (on buildings canvas, above buildings)
  ctx.strokeStyle = cableColor;
  ctx.lineWidth = 1.25;
  
  const leftBarrierMidX = (cableAttachLeft.startX + cableAttachLeft.endX) / 2;
  const rightBarrierMidX = (cableAttachRight.startX + cableAttachRight.endX) / 2;
  
  const backToLeft = Math.abs(backTower.x - leftBarrierMidX);
  const backToRight = Math.abs(backTower.x - rightBarrierMidX);
  const backAttach = backToLeft < backToRight ? cableAttachLeft : cableAttachRight;
  const frontAttach = backToLeft < backToRight ? cableAttachRight : cableAttachLeft;
  
  const drawCableArc = (fromX: number, fromY: number, toX: number, toY: number) => {
    const midX = (fromX + toX) / 2;
    const midY = (fromY + toY) / 2;
    const sag = 8;
    const controlX = midX;
    const controlY = midY + sag;
    
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.quadraticCurveTo(controlX, controlY, toX, toY);
    ctx.stroke();
  };
  
  const backTowerTop = cy - suspTowerH + backTowerYOffset;
  drawCableArc(backTower.x, backTowerTop, backAttach.startX, backAttach.startY);
  drawCableArc(backTower.x, backTowerTop, backAttach.endX, backAttach.endY);
  
  const frontTowerTop = cy - suspTowerH + frontTowerYOffset;
  drawCableArc(frontTower.x, frontTowerTop, frontAttach.startX, frontAttach.startY);
  drawCableArc(frontTower.x, frontTowerTop, frontAttach.endX, frontAttach.endY);
}
