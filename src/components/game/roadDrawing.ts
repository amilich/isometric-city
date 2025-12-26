/**
 * Road Drawing System - Renders isometric roads with lane markings, sidewalks, and traffic features
 * Extracted from CanvasIsometricGrid for better maintainability
 */

import { TILE_WIDTH, TILE_HEIGHT } from './types';
import {
  TRAFFIC_LIGHT_MIN_ZOOM,
  DIRECTION_ARROWS_MIN_ZOOM,
  MEDIAN_PLANTS_MIN_ZOOM,
  LANE_MARKINGS_MIN_ZOOM,
  SIDEWALK_MIN_ZOOM,
  SIDEWALK_MIN_ZOOM_MOBILE,
} from './constants';
import {
  analyzeMergedRoad,
  getTrafficLightState,
  drawTrafficLight,
  getTrafficFlowDirection,
  drawCrosswalks,
  ROAD_COLORS,
  drawRoadArrow,
} from './trafficSystem';
import { Tile } from '@/types/game';

// ============================================================================
// Types
// ============================================================================

/** Result of analyzing merged road configuration */
export type MergedRoadInfo = ReturnType<typeof analyzeMergedRoad>;

/** Options for road drawing that come from component state */
export interface RoadDrawingOptions {
  /** Function to check if a tile has a road/bridge */
  hasRoad: (gridX: number, gridY: number) => boolean;
  /** Function to get cached merge analysis for a tile */
  getMergeInfo: (gridX: number, gridY: number) => MergedRoadInfo;
  /** Is the app in mobile mode */
  isMobile: boolean;
  /** Is the user currently panning */
  isPanning: boolean;
  /** Is the user currently pinch-zooming */
  isPinchZooming: boolean;
  /** Current traffic light timer value */
  trafficLightTimer: number;
}

// ============================================================================
// Road Drawing
// ============================================================================

/**
 * Draw a sophisticated road tile with merged avenues/highways, traffic lights, and proper lane directions
 */
export function drawRoad(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  gridX: number,
  gridY: number,
  currentZoom: number,
  options: RoadDrawingOptions
): void {
  const { hasRoad, getMergeInfo, isMobile, isPanning, isPinchZooming, trafficLightTimer } = options;
  
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = x + w / 2;
  const cy = y + h / 2;
  
  // Check adjacency (in isometric coordinates)
  const north = hasRoad(gridX - 1, gridY);  // top-left edge
  const east = hasRoad(gridX, gridY - 1);   // top-right edge
  const south = hasRoad(gridX + 1, gridY);  // bottom-right edge
  const west = hasRoad(gridX, gridY + 1);   // bottom-left edge
  
  // Analyze if this road is part of a merged avenue/highway (CACHED for performance)
  const mergeInfo = getMergeInfo(gridX, gridY);
  
  // Calculate base road width based on road type
  const laneWidthRatio = mergeInfo.type === 'highway' ? 0.16 :
                        mergeInfo.type === 'avenue' ? 0.15 :
                        0.14;
  const roadW = w * laneWidthRatio;
  
  // Sidewalk configuration
  const sidewalkWidth = w * 0.08;
  const sidewalkColor = ROAD_COLORS.SIDEWALK;
  const curbColor = ROAD_COLORS.CURB;
  
  // Edge stop distance
  const edgeStop = 0.98;
  
  // Calculate edge midpoints
  const northEdgeX = x + w * 0.25;
  const northEdgeY = y + h * 0.25;
  const eastEdgeX = x + w * 0.75;
  const eastEdgeY = y + h * 0.25;
  const southEdgeX = x + w * 0.75;
  const southEdgeY = y + h * 0.75;
  const westEdgeX = x + w * 0.25;
  const westEdgeY = y + h * 0.75;
  
  // Direction vectors
  const northDx = (northEdgeX - cx) / Math.hypot(northEdgeX - cx, northEdgeY - cy);
  const northDy = (northEdgeY - cy) / Math.hypot(northEdgeX - cx, northEdgeY - cy);
  const eastDx = (eastEdgeX - cx) / Math.hypot(eastEdgeX - cx, eastEdgeY - cy);
  const eastDy = (eastEdgeY - cy) / Math.hypot(eastEdgeX - cx, eastEdgeY - cy);
  const southDx = (southEdgeX - cx) / Math.hypot(southEdgeX - cx, southEdgeY - cy);
  const southDy = (southEdgeY - cy) / Math.hypot(southEdgeX - cx, southEdgeY - cy);
  const westDx = (westEdgeX - cx) / Math.hypot(westEdgeX - cx, westEdgeY - cy);
  const westDy = (westEdgeY - cy) / Math.hypot(westEdgeX - cx, westEdgeY - cy);
  
  const getPerp = (dx: number, dy: number) => ({ nx: -dy, ny: dx });
  
  // Diamond corners
  const topCorner = { x: x + w / 2, y: y };
  const rightCorner = { x: x + w, y: y + h / 2 };
  const bottomCorner = { x: x + w / 2, y: y + h };
  const leftCorner = { x: x, y: y + h / 2 };
  
  // ============================================
  // DRAW SIDEWALKS (only on outer edges of merged roads)
  // ============================================
  // Use mobile-specific zoom threshold (lower = visible when more zoomed out)
  const sidewalkMinZoom = isMobile ? SIDEWALK_MIN_ZOOM_MOBILE : SIDEWALK_MIN_ZOOM;
  const showSidewalks = currentZoom >= sidewalkMinZoom;
  
  const isOuterEdge = (edgeDir: 'north' | 'east' | 'south' | 'west') => {
    // For merged roads, only draw sidewalks on the outermost tiles
    if (mergeInfo.type === 'single') return true;
    
    if (mergeInfo.orientation === 'ns') {
      // NS roads: sidewalks on east/west edges of outermost tiles
      if (edgeDir === 'east') return mergeInfo.side === 'right';
      if (edgeDir === 'west') return mergeInfo.side === 'left';
      return true; // north/south always have sidewalks if no road
    }
    if (mergeInfo.orientation === 'ew') {
      // EW roads: sidewalks on north/south edges of outermost tiles
      if (edgeDir === 'north') return mergeInfo.side === 'left';
      if (edgeDir === 'south') return mergeInfo.side === 'right';
      return true;
    }
    return true;
  };
  
  const drawSidewalkEdge = (
    startX: number, startY: number,
    endX: number, endY: number,
    inwardDx: number, inwardDy: number,
    shortenStart: boolean = false,
    shortenEnd: boolean = false
  ) => {
    const swWidth = sidewalkWidth;
    const shortenDist = swWidth * 0.707;
    
    const edgeDx = endX - startX;
    const edgeDy = endY - startY;
    const edgeLen = Math.hypot(edgeDx, edgeDy);
    const edgeDirX = edgeDx / edgeLen;
    const edgeDirY = edgeDy / edgeLen;
    
    let actualStartX = startX, actualStartY = startY;
    let actualEndX = endX, actualEndY = endY;
    
    if (shortenStart && edgeLen > shortenDist * 2) {
      actualStartX = startX + edgeDirX * shortenDist;
      actualStartY = startY + edgeDirY * shortenDist;
    }
    if (shortenEnd && edgeLen > shortenDist * 2) {
      actualEndX = endX - edgeDirX * shortenDist;
      actualEndY = endY - edgeDirY * shortenDist;
    }
    
    ctx.strokeStyle = curbColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(actualStartX, actualStartY);
    ctx.lineTo(actualEndX, actualEndY);
    ctx.stroke();
    
    ctx.fillStyle = sidewalkColor;
    ctx.beginPath();
    ctx.moveTo(actualStartX, actualStartY);
    ctx.lineTo(actualEndX, actualEndY);
    ctx.lineTo(actualEndX + inwardDx * swWidth, actualEndY + inwardDy * swWidth);
    ctx.lineTo(actualStartX + inwardDx * swWidth, actualStartY + inwardDy * swWidth);
    ctx.closePath();
    ctx.fill();
  };
  
  // Draw sidewalks on edges without roads (only on outer edges for merged roads)
  if (showSidewalks && !north && isOuterEdge('north')) {
    drawSidewalkEdge(leftCorner.x, leftCorner.y, topCorner.x, topCorner.y, 0.707, 0.707, !west && isOuterEdge('west'), !east && isOuterEdge('east'));
  }
  if (showSidewalks && !east && isOuterEdge('east')) {
    drawSidewalkEdge(topCorner.x, topCorner.y, rightCorner.x, rightCorner.y, -0.707, 0.707, !north && isOuterEdge('north'), !south && isOuterEdge('south'));
  }
  if (showSidewalks && !south && isOuterEdge('south')) {
    drawSidewalkEdge(rightCorner.x, rightCorner.y, bottomCorner.x, bottomCorner.y, -0.707, -0.707, !east && isOuterEdge('east'), !west && isOuterEdge('west'));
  }
  if (showSidewalks && !west && isOuterEdge('west')) {
    drawSidewalkEdge(bottomCorner.x, bottomCorner.y, leftCorner.x, leftCorner.y, 0.707, -0.707, !south && isOuterEdge('south'), !north && isOuterEdge('north'));
  }
  
  // Corner sidewalk pieces
  const swWidth = sidewalkWidth;
  const shortenDist = swWidth * 0.707;
  ctx.fillStyle = sidewalkColor;
  
  const getShortenedInnerEndpoint = (cornerX: number, cornerY: number, otherCornerX: number, otherCornerY: number, inwardDx: number, inwardDy: number) => {
    const edgeDx = cornerX - otherCornerX;
    const edgeDy = cornerY - otherCornerY;
    const edgeLen = Math.hypot(edgeDx, edgeDy);
    const edgeDirX = edgeDx / edgeLen;
    const edgeDirY = edgeDy / edgeLen;
    const shortenedOuterX = cornerX - edgeDirX * shortenDist;
    const shortenedOuterY = cornerY - edgeDirY * shortenDist;
    return { x: shortenedOuterX + inwardDx * swWidth, y: shortenedOuterY + inwardDy * swWidth };
  };
  
  // Draw corner pieces only for outer edges (when zoomed in enough)
  if (showSidewalks && !north && !east && isOuterEdge('north') && isOuterEdge('east')) {
    const northInner = getShortenedInnerEndpoint(topCorner.x, topCorner.y, leftCorner.x, leftCorner.y, 0.707, 0.707);
    const eastInner = getShortenedInnerEndpoint(topCorner.x, topCorner.y, rightCorner.x, rightCorner.y, -0.707, 0.707);
    ctx.beginPath();
    ctx.moveTo(topCorner.x, topCorner.y);
    ctx.lineTo(northInner.x, northInner.y);
    ctx.lineTo(eastInner.x, eastInner.y);
    ctx.closePath();
    ctx.fill();
  }
  if (showSidewalks && !east && !south && isOuterEdge('east') && isOuterEdge('south')) {
    const eastInner = getShortenedInnerEndpoint(rightCorner.x, rightCorner.y, topCorner.x, topCorner.y, -0.707, 0.707);
    const southInner = getShortenedInnerEndpoint(rightCorner.x, rightCorner.y, bottomCorner.x, bottomCorner.y, -0.707, -0.707);
    ctx.beginPath();
    ctx.moveTo(rightCorner.x, rightCorner.y);
    ctx.lineTo(eastInner.x, eastInner.y);
    ctx.lineTo(southInner.x, southInner.y);
    ctx.closePath();
    ctx.fill();
  }
  if (showSidewalks && !south && !west && isOuterEdge('south') && isOuterEdge('west')) {
    const southInner = getShortenedInnerEndpoint(bottomCorner.x, bottomCorner.y, rightCorner.x, rightCorner.y, -0.707, -0.707);
    const westInner = getShortenedInnerEndpoint(bottomCorner.x, bottomCorner.y, leftCorner.x, leftCorner.y, 0.707, -0.707);
    ctx.beginPath();
    ctx.moveTo(bottomCorner.x, bottomCorner.y);
    ctx.lineTo(southInner.x, southInner.y);
    ctx.lineTo(westInner.x, westInner.y);
    ctx.closePath();
    ctx.fill();
  }
  if (showSidewalks && !west && !north && isOuterEdge('west') && isOuterEdge('north')) {
    const westInner = getShortenedInnerEndpoint(leftCorner.x, leftCorner.y, bottomCorner.x, bottomCorner.y, 0.707, -0.707);
    const northInner = getShortenedInnerEndpoint(leftCorner.x, leftCorner.y, topCorner.x, topCorner.y, 0.707, 0.707);
    ctx.beginPath();
    ctx.moveTo(leftCorner.x, leftCorner.y);
    ctx.lineTo(westInner.x, westInner.y);
    ctx.lineTo(northInner.x, northInner.y);
    ctx.closePath();
    ctx.fill();
  }
  
  // ============================================
  // DRAW ROAD SURFACE
  // ============================================
  // Use different asphalt color for highways
  ctx.fillStyle = mergeInfo.type === 'highway' ? '#3d3d3d' : 
                  mergeInfo.type === 'avenue' ? '#454545' : ROAD_COLORS.ASPHALT;
  
  // Draw road segments
  if (north) {
    const stopX = cx + (northEdgeX - cx) * edgeStop;
    const stopY = cy + (northEdgeY - cy) * edgeStop;
    const perp = getPerp(northDx, northDy);
    const halfWidth = roadW * 0.5;
    ctx.beginPath();
    ctx.moveTo(cx + perp.nx * halfWidth, cy + perp.ny * halfWidth);
    ctx.lineTo(stopX + perp.nx * halfWidth, stopY + perp.ny * halfWidth);
    ctx.lineTo(stopX - perp.nx * halfWidth, stopY - perp.ny * halfWidth);
    ctx.lineTo(cx - perp.nx * halfWidth, cy - perp.ny * halfWidth);
    ctx.closePath();
    ctx.fill();
  }
  
  if (east) {
    const stopX = cx + (eastEdgeX - cx) * edgeStop;
    const stopY = cy + (eastEdgeY - cy) * edgeStop;
    const perp = getPerp(eastDx, eastDy);
    const halfWidth = roadW * 0.5;
    ctx.beginPath();
    ctx.moveTo(cx + perp.nx * halfWidth, cy + perp.ny * halfWidth);
    ctx.lineTo(stopX + perp.nx * halfWidth, stopY + perp.ny * halfWidth);
    ctx.lineTo(stopX - perp.nx * halfWidth, stopY - perp.ny * halfWidth);
    ctx.lineTo(cx - perp.nx * halfWidth, cy - perp.ny * halfWidth);
    ctx.closePath();
    ctx.fill();
  }
  
  if (south) {
    const stopX = cx + (southEdgeX - cx) * edgeStop;
    const stopY = cy + (southEdgeY - cy) * edgeStop;
    const perp = getPerp(southDx, southDy);
    const halfWidth = roadW * 0.5;
    ctx.beginPath();
    ctx.moveTo(cx + perp.nx * halfWidth, cy + perp.ny * halfWidth);
    ctx.lineTo(stopX + perp.nx * halfWidth, stopY + perp.ny * halfWidth);
    ctx.lineTo(stopX - perp.nx * halfWidth, stopY - perp.ny * halfWidth);
    ctx.lineTo(cx - perp.nx * halfWidth, cy - perp.ny * halfWidth);
    ctx.closePath();
    ctx.fill();
  }
  
  if (west) {
    const stopX = cx + (westEdgeX - cx) * edgeStop;
    const stopY = cy + (westEdgeY - cy) * edgeStop;
    const perp = getPerp(westDx, westDy);
    const halfWidth = roadW * 0.5;
    ctx.beginPath();
    ctx.moveTo(cx + perp.nx * halfWidth, cy + perp.ny * halfWidth);
    ctx.lineTo(stopX + perp.nx * halfWidth, stopY + perp.ny * halfWidth);
    ctx.lineTo(stopX - perp.nx * halfWidth, stopY - perp.ny * halfWidth);
    ctx.lineTo(cx - perp.nx * halfWidth, cy - perp.ny * halfWidth);
    ctx.closePath();
    ctx.fill();
  }
  
  // Center intersection
  const centerSize = roadW * 1.4;
  ctx.beginPath();
  ctx.moveTo(cx, cy - centerSize);
  ctx.lineTo(cx + centerSize, cy);
  ctx.lineTo(cx, cy + centerSize);
  ctx.lineTo(cx - centerSize, cy);
  ctx.closePath();
  ctx.fill();
  
  // Interior sidewalk corners - small isometric diamonds at corners where two roads meet
  // Each corner drawn independently based on its two adjacent road directions
  if (showSidewalks) {
    ctx.fillStyle = sidewalkColor;
    const cs = swWidth * 0.8;
    const isFourWay = north && east && south && west;
    
    // Top corner - draw if north AND east both have roads
    if (north && east) {
      ctx.beginPath();
      ctx.moveTo(topCorner.x, topCorner.y);
      ctx.lineTo(topCorner.x - cs, topCorner.y + cs * 0.5);
      ctx.lineTo(topCorner.x, topCorner.y + cs);
      ctx.lineTo(topCorner.x + cs, topCorner.y + cs * 0.5);
      ctx.closePath();
      ctx.fill();
    }
    
    // Right corner - draw if east AND south both have roads
    if (east && south) {
      ctx.beginPath();
      ctx.moveTo(rightCorner.x, rightCorner.y);
      if (isFourWay) {
        // At 4-way intersections, use rotated shape (tall/narrow)
        ctx.lineTo(rightCorner.x - cs * 0.625, rightCorner.y - cs * 1.25);
        ctx.lineTo(rightCorner.x - cs * 1.25, rightCorner.y);
        ctx.lineTo(rightCorner.x - cs * 0.625, rightCorner.y + cs * 1.25);
      } else {
        // At T-intersections/corners, use flat shape
        ctx.lineTo(rightCorner.x - cs, rightCorner.y - cs * 0.5);
        ctx.lineTo(rightCorner.x - cs * 2, rightCorner.y);
        ctx.lineTo(rightCorner.x - cs, rightCorner.y + cs * 0.5);
      }
      ctx.closePath();
      ctx.fill();
    }
    
    // Bottom corner - draw if south AND west both have roads
    if (south && west) {
      ctx.beginPath();
      ctx.moveTo(bottomCorner.x, bottomCorner.y);
      ctx.lineTo(bottomCorner.x + cs, bottomCorner.y - cs * 0.5);
      ctx.lineTo(bottomCorner.x, bottomCorner.y - cs);
      ctx.lineTo(bottomCorner.x - cs, bottomCorner.y - cs * 0.5);
      ctx.closePath();
      ctx.fill();
    }
    
    // Left corner - draw if west AND north both have roads
    if (west && north) {
      ctx.beginPath();
      ctx.moveTo(leftCorner.x, leftCorner.y);
      if (isFourWay) {
        // At 4-way intersections, use rotated shape (tall/narrow)
        ctx.lineTo(leftCorner.x + cs * 0.625, leftCorner.y - cs * 1.25);
        ctx.lineTo(leftCorner.x + cs * 1.25, leftCorner.y);
        ctx.lineTo(leftCorner.x + cs * 0.625, leftCorner.y + cs * 1.25);
      } else {
        // At T-intersections/corners, use flat shape
        ctx.lineTo(leftCorner.x + cs, leftCorner.y - cs * 0.5);
        ctx.lineTo(leftCorner.x + cs * 2, leftCorner.y);
        ctx.lineTo(leftCorner.x + cs, leftCorner.y + cs * 0.5);
      }
      ctx.closePath();
      ctx.fill();
    }
  }
  
  // ============================================
  // DRAW LANE MARKINGS AND MEDIANS
  // ============================================
  if (currentZoom >= LANE_MARKINGS_MIN_ZOOM) {
    const connectionCount = [north, east, south, west].filter(Boolean).length;
    const isIntersection = connectionCount >= 3;
    
    // For merged roads, draw white lane divider lines instead of yellow center
    if (mergeInfo.type !== 'single' && mergeInfo.side === 'center') {
      // Center tiles of merged roads get white lane dividers
      ctx.strokeStyle = ROAD_COLORS.LANE_MARKING;
      ctx.lineWidth = 0.6;
      ctx.setLineDash([2, 3]);
      
      if (mergeInfo.orientation === 'ns' && (north || south)) {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        if (north) ctx.lineTo(northEdgeX, northEdgeY);
        ctx.moveTo(cx, cy);
        if (south) ctx.lineTo(southEdgeX, southEdgeY);
        ctx.stroke();
      } else if (mergeInfo.orientation === 'ew' && (east || west)) {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        if (east) ctx.lineTo(eastEdgeX, eastEdgeY);
        ctx.moveTo(cx, cy);
        if (west) ctx.lineTo(westEdgeX, westEdgeY);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
    
    // Draw median on the boundary between opposing traffic
    if (mergeInfo.hasMedian && mergeInfo.mergeWidth >= 2) {
      // Determine if this tile is at the median boundary
      const medianPosition = Math.floor(mergeInfo.mergeWidth / 2) - 1;
      
      if (mergeInfo.positionInMerge === medianPosition) {
        // Draw median divider (double yellow or planted median)
        if (mergeInfo.orientation === 'ns') {
          // Median runs NS - draw on the west edge of this tile
          if (mergeInfo.medianType === 'plants' && currentZoom >= MEDIAN_PLANTS_MIN_ZOOM) {
            // Draw planted median
            ctx.fillStyle = '#6b7280'; // Concrete base
            const medianW = 3;
            ctx.fillRect(westEdgeX - medianW, westEdgeY - 2, medianW * 2, (southEdgeY - westEdgeY) + 4);
            
            // Draw small plants/shrubs
            ctx.fillStyle = '#4a7c3f';
            const plantSpacing = 10;
            const numPlants = Math.floor(Math.abs(southEdgeY - westEdgeY) / plantSpacing);
            for (let i = 1; i < numPlants; i++) {
              const py = westEdgeY + (southEdgeY - westEdgeY) * (i / numPlants);
              const px = westEdgeX + (southEdgeX - westEdgeX) * (i / numPlants);
              ctx.beginPath();
              ctx.arc(px, py - 1, 2, 0, Math.PI * 2);
              ctx.fill();
            }
          } else {
            // Draw double yellow line
            ctx.strokeStyle = ROAD_COLORS.CENTER_LINE;
            ctx.lineWidth = 1.2;
            ctx.setLineDash([]);
            
            const offsetX = -1.5;
            ctx.beginPath();
            ctx.moveTo(northEdgeX + offsetX, northEdgeY);
            ctx.lineTo(southEdgeX + offsetX, southEdgeY);
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(northEdgeX + offsetX + 3, northEdgeY);
            ctx.lineTo(southEdgeX + offsetX + 3, southEdgeY);
            ctx.stroke();
          }
        } else if (mergeInfo.orientation === 'ew') {
          // Median runs EW - draw on the south edge of this tile
          if (mergeInfo.medianType === 'plants' && currentZoom >= MEDIAN_PLANTS_MIN_ZOOM) {
            ctx.fillStyle = '#6b7280';
            const medianW = 3;
            ctx.fillRect(eastEdgeX - 2, eastEdgeY - medianW, (westEdgeX - eastEdgeX) + 4, medianW * 2);
            
            ctx.fillStyle = '#4a7c3f';
            const plantSpacing = 10;
            const numPlants = Math.floor(Math.abs(westEdgeX - eastEdgeX) / plantSpacing);
            for (let i = 1; i < numPlants; i++) {
              const px = eastEdgeX + (westEdgeX - eastEdgeX) * (i / numPlants);
              const py = eastEdgeY + (westEdgeY - eastEdgeY) * (i / numPlants);
              ctx.beginPath();
              ctx.arc(px, py - 1, 2, 0, Math.PI * 2);
              ctx.fill();
            }
          } else {
            ctx.strokeStyle = ROAD_COLORS.CENTER_LINE;
            ctx.lineWidth = 1.2;
            ctx.setLineDash([]);
            
            const offsetY = -1.5;
            ctx.beginPath();
            ctx.moveTo(eastEdgeX, eastEdgeY + offsetY);
            ctx.lineTo(westEdgeX, westEdgeY + offsetY);
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(eastEdgeX, eastEdgeY + offsetY + 3);
            ctx.lineTo(westEdgeX, westEdgeY + offsetY + 3);
            ctx.stroke();
          }
        }
      }
    }
    
    // Draw yellow center dashes for non-intersection roads only
    // Skip if this tile IS an intersection (3+ adjacent roads)
    const thisIsIntersection = [north, east, south, west].filter(Boolean).length >= 3;
    if (!thisIsIntersection) {
      ctx.strokeStyle = ROAD_COLORS.CENTER_LINE;
      ctx.lineWidth = 0.8;
      ctx.setLineDash([1.5, 2]);
      ctx.lineCap = 'round';
      
      // Helper to check if adjacent tile is an intersection
      const isAdjIntersection = (adjX: number, adjY: number): boolean => {
        if (!hasRoad(adjX, adjY)) return false;
        const aN = hasRoad(adjX - 1, adjY);
        const aE = hasRoad(adjX, adjY - 1);
        const aS = hasRoad(adjX + 1, adjY);
        const aW = hasRoad(adjX, adjY + 1);
        return [aN, aE, aS, aW].filter(Boolean).length >= 3;
      };
      
      // Line stops before sidewalk markers if approaching intersection, otherwise extends
      const markingOverlap = 8;
      const markingStartOffset = 0;
      const stopBeforeCrosswalk = 0.58; // Stop at 58% toward edge - just before sidewalk corner markers
      
      if (north) {
        const adjIsIntersection = isAdjIntersection(gridX - 1, gridY);
        if (adjIsIntersection) {
          // Stop before crosswalk
          const stopX = cx + (northEdgeX - cx) * stopBeforeCrosswalk;
          const stopY = cy + (northEdgeY - cy) * stopBeforeCrosswalk;
          ctx.beginPath();
          ctx.moveTo(cx + northDx * markingStartOffset, cy + northDy * markingStartOffset);
          ctx.lineTo(stopX, stopY);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.moveTo(cx + northDx * markingStartOffset, cy + northDy * markingStartOffset);
          ctx.lineTo(northEdgeX + northDx * markingOverlap, northEdgeY + northDy * markingOverlap);
          ctx.stroke();
        }
      }
      if (east) {
        const adjIsIntersection = isAdjIntersection(gridX, gridY - 1);
        if (adjIsIntersection) {
          const stopX = cx + (eastEdgeX - cx) * stopBeforeCrosswalk;
          const stopY = cy + (eastEdgeY - cy) * stopBeforeCrosswalk;
          ctx.beginPath();
          ctx.moveTo(cx + eastDx * markingStartOffset, cy + eastDy * markingStartOffset);
          ctx.lineTo(stopX, stopY);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.moveTo(cx + eastDx * markingStartOffset, cy + eastDy * markingStartOffset);
          ctx.lineTo(eastEdgeX + eastDx * markingOverlap, eastEdgeY + eastDy * markingOverlap);
          ctx.stroke();
        }
      }
      if (south) {
        const adjIsIntersection = isAdjIntersection(gridX + 1, gridY);
        if (adjIsIntersection) {
          const stopX = cx + (southEdgeX - cx) * stopBeforeCrosswalk;
          const stopY = cy + (southEdgeY - cy) * stopBeforeCrosswalk;
          ctx.beginPath();
          ctx.moveTo(cx + southDx * markingStartOffset, cy + southDy * markingStartOffset);
          ctx.lineTo(stopX, stopY);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.moveTo(cx + southDx * markingStartOffset, cy + southDy * markingStartOffset);
          ctx.lineTo(southEdgeX + southDx * markingOverlap, southEdgeY + southDy * markingOverlap);
          ctx.stroke();
        }
      }
      if (west) {
        const adjIsIntersection = isAdjIntersection(gridX, gridY + 1);
        if (adjIsIntersection) {
          const stopX = cx + (westEdgeX - cx) * stopBeforeCrosswalk;
          const stopY = cy + (westEdgeY - cy) * stopBeforeCrosswalk;
          ctx.beginPath();
          ctx.moveTo(cx + westDx * markingStartOffset, cy + westDy * markingStartOffset);
          ctx.lineTo(stopX, stopY);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.moveTo(cx + westDx * markingStartOffset, cy + westDy * markingStartOffset);
          ctx.lineTo(westEdgeX + westDx * markingOverlap, westEdgeY + westDy * markingOverlap);
          ctx.stroke();
        }
      }
      
      ctx.setLineDash([]);
      ctx.lineCap = 'butt';
    }
    
    // Draw directional arrows for merged roads
    if (mergeInfo.type !== 'single' && currentZoom >= DIRECTION_ARROWS_MIN_ZOOM && mergeInfo.side !== 'center') {
      const flowDirs = getTrafficFlowDirection(mergeInfo);
      if (flowDirs.length === 1) {
        drawRoadArrow(ctx, cx, cy, flowDirs[0], currentZoom);
      }
    }
    
    // ============================================
    // DRAW CROSSWALKS (on tiles adjacent to real intersections with traffic lights)
    // ============================================
    drawCrosswalks({
      ctx,
      x,
      y,
      gridX,
      gridY,
      zoom: currentZoom,
      roadW,
      adj: { north, east, south, west },
      hasRoad,
    });
    
    // ============================================
    // DRAW TRAFFIC LIGHTS AT INTERSECTIONS
    // ============================================
    // PERF: Skip traffic lights during mobile panning/zooming for better performance
    const skipTrafficLights = isMobile && (isPanning || isPinchZooming);
    if (isIntersection && currentZoom >= TRAFFIC_LIGHT_MIN_ZOOM && !skipTrafficLights) {
      const lightState = getTrafficLightState(trafficLightTimer);
      
      // Draw traffic lights at corners where roads meet
      // Position them at the corners of the intersection
      if (north && west) {
        drawTrafficLight(ctx, x, y, lightState, 'nw', currentZoom);
      }
      if (north && east) {
        drawTrafficLight(ctx, x, y, lightState, 'ne', currentZoom);
      }
      if (south && west) {
        drawTrafficLight(ctx, x, y, lightState, 'sw', currentZoom);
      }
      if (south && east) {
        drawTrafficLight(ctx, x, y, lightState, 'se', currentZoom);
      }
    }
  }
}

// ============================================================================
// Road Merge Analysis Cache Helper
// ============================================================================

/**
 * Create a cached merge info getter with proper invalidation
 */
export function createMergeInfoCache(
  grid: Tile[][],
  gridSize: number,
  cacheRef: React.MutableRefObject<Map<string, MergedRoadInfo>>,
  cacheVersionRef: React.MutableRefObject<number>,
  gridVersionRef: React.MutableRefObject<number>
): (gx: number, gy: number) => MergedRoadInfo {
  return (gx: number, gy: number): MergedRoadInfo => {
    const currentVersion = gridVersionRef.current;
    if (cacheVersionRef.current !== currentVersion) {
      cacheRef.current.clear();
      cacheVersionRef.current = currentVersion;
    }
    
    const key = `${gx},${gy}`;
    let info = cacheRef.current.get(key);
    if (!info) {
      info = analyzeMergedRoad(grid, gridSize, gx, gy);
      cacheRef.current.set(key, info);
    }
    return info;
  };
}
