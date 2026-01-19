'use client';

import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { useCoaster } from '@/context/CoasterContext';
import { Tile, Tool, TOOL_INFO } from '@/games/coaster/types';
import { getSpriteInfo, getSpriteRect, COASTER_SPRITE_PACK } from '@/games/coaster/lib/coasterRenderConfig';

// Helper to get building size for a tool (defaults to 1x1)
function getToolBuildingSize(tool: Tool): { width: number; height: number } {
  const info = TOOL_INFO[tool];
  return info?.size ?? { width: 1, height: 1 };
}
import { drawStraightTrack, drawCurvedTrack, drawSlopeTrack, drawLoopTrack, drawChainLift } from '@/components/coaster/tracks';
import { drawGuest } from '@/components/coaster/guests';

// Track tools that support drag-to-draw
const TRACK_DRAG_TOOLS: Tool[] = [
  'coaster_build',
  'coaster_track',
  'path',
  'bulldoze',
];

// =============================================================================
// CONSTANTS (shared with isocity)
// =============================================================================

const TILE_WIDTH = 64;
const HEIGHT_RATIO = 0.60;
const TILE_HEIGHT = TILE_WIDTH * HEIGHT_RATIO;
const ZOOM_MIN = 0.3;
const ZOOM_MAX = 2.5;
const HEIGHT_UNIT = 20;

// Water texture path (same as city game)
const WATER_ASSET_PATH = '/assets/water.png';

// Background color to filter (red)
const BACKGROUND_COLOR = { r: 255, g: 0, b: 0 };
const COLOR_THRESHOLD = 155;

// =============================================================================
// SPRITE SHEET LOADING
// =============================================================================

function filterBackgroundColor(img: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    const distance = Math.sqrt(
      Math.pow(r - BACKGROUND_COLOR.r, 2) +
      Math.pow(g - BACKGROUND_COLOR.g, 2) +
      Math.pow(b - BACKGROUND_COLOR.b, 2)
    );
    
    if (distance <= COLOR_THRESHOLD) {
      data[i + 3] = 0; // Make transparent
    }
  }
  
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function gridToScreen(
  gridX: number,
  gridY: number,
  offsetX: number,
  offsetY: number
): { screenX: number; screenY: number } {
  const screenX = (gridX - gridY) * (TILE_WIDTH / 2) + offsetX;
  const screenY = (gridX + gridY) * (TILE_HEIGHT / 2) + offsetY;
  return { screenX, screenY };
}

function screenToGrid(
  screenX: number,
  screenY: number,
  offsetX: number,
  offsetY: number
): { gridX: number; gridY: number } {
  const adjustedX = screenX - offsetX;
  const adjustedY = screenY - offsetY;
  
  const gridX = (adjustedX / (TILE_WIDTH / 2) + adjustedY / (TILE_HEIGHT / 2)) / 2;
  const gridY = (adjustedY / (TILE_HEIGHT / 2) - adjustedX / (TILE_WIDTH / 2)) / 2;
  
  return { gridX: Math.floor(gridX), gridY: Math.floor(gridY) };
}

// =============================================================================
// DRAWING FUNCTIONS
// =============================================================================

// Grass tile colors matching the city game
const GRASS_COLORS = {
  top: '#4a7c3f',
  left: '#3d6634',
  right: '#5a8f4f',
  stroke: '#2d4a26',
};

function drawGrassTile(ctx: CanvasRenderingContext2D, x: number, y: number, zoom: number = 1) {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  
  // Draw the isometric diamond (top face)
  ctx.fillStyle = GRASS_COLORS.top;
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y);
  ctx.lineTo(x + w, y + h / 2);
  ctx.lineTo(x + w / 2, y + h);
  ctx.lineTo(x, y + h / 2);
  ctx.closePath();
  ctx.fill();
  
  // Draw stroke when zoomed in enough (matching city game behavior)
  if (zoom >= 0.6) {
    ctx.strokeStyle = GRASS_COLORS.stroke;
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }
}

// Water tile colors (fallback if texture not loaded)
const WATER_COLORS = {
  base: '#0ea5e9',
  stroke: '#0284c7',
};

function drawWaterTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  gridX: number,
  gridY: number,
  grid: Tile[][],
  gridSize: number,
  waterImage: HTMLImageElement | null,
  zoom: number = 1
) {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  
  // Check which adjacent tiles are also water for blending
  const adjacentWater = {
    north: gridX > 0 && grid[gridY]?.[gridX - 1]?.terrain === 'water',
    east: gridY > 0 && grid[gridY - 1]?.[gridX]?.terrain === 'water',
    south: gridX < gridSize - 1 && grid[gridY]?.[gridX + 1]?.terrain === 'water',
    west: gridY < gridSize - 1 && grid[gridY + 1]?.[gridX]?.terrain === 'water',
  };
  
  // Count adjacent water tiles
  const adjacentCount = (adjacentWater.north ? 1 : 0) + (adjacentWater.east ? 1 : 0) + 
                       (adjacentWater.south ? 1 : 0) + (adjacentWater.west ? 1 : 0);
  
  if (waterImage && waterImage.complete && waterImage.naturalWidth > 0) {
    // Use water texture (same approach as city game)
    const tileCenterX = x + w / 2;
    const tileCenterY = y + h / 2;
    
    // Random subcrop of water texture based on tile position for variety
    const imgW = waterImage.naturalWidth || waterImage.width;
    const imgH = waterImage.naturalHeight || waterImage.height;
    
    // Deterministic "random" offset based on tile position
    const seedX = ((gridX * 7919 + gridY * 6271) % 1000) / 1000;
    const seedY = ((gridX * 4177 + gridY * 9311) % 1000) / 1000;
    
    // Take a subcrop - use 35% of the image, offset randomly for variety
    const cropScale = 0.35;
    const cropW = imgW * cropScale;
    const cropH = imgH * cropScale;
    const maxOffsetX = imgW - cropW;
    const maxOffsetY = imgH - cropH;
    const srcX = seedX * maxOffsetX;
    const srcY = seedY * maxOffsetY;
    
    // Create a clipping path - expand toward adjacent WATER tiles only
    const expand = w * 0.4;
    
    // Calculate expanded corners based on water adjacency
    const topY = y - (adjacentWater.north && adjacentWater.east ? expand * 0.5 : 0);
    const rightX = x + w + ((adjacentWater.east && adjacentWater.south) ? expand * 0.5 : 0);
    const bottomY = y + h + ((adjacentWater.south && adjacentWater.west) ? expand * 0.5 : 0);
    const leftX = x - ((adjacentWater.west && adjacentWater.north) ? expand * 0.5 : 0);
    
    const topExpand = (adjacentWater.north && adjacentWater.east) ? expand * 0.3 : 0;
    const rightExpand = (adjacentWater.east && adjacentWater.south) ? expand * 0.3 : 0;
    const bottomExpand = (adjacentWater.south && adjacentWater.west) ? expand * 0.3 : 0;
    const leftExpand = (adjacentWater.west && adjacentWater.north) ? expand * 0.3 : 0;
    
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x + w / 2, topY - topExpand);
    ctx.lineTo(rightX + rightExpand, y + h / 2);
    ctx.lineTo(x + w / 2, bottomY + bottomExpand);
    ctx.lineTo(leftX - leftExpand, y + h / 2);
    ctx.closePath();
    ctx.clip();
    
    const aspectRatio = cropH / cropW;
    const savedAlpha = ctx.globalAlpha;
    
    // Jitter for variety
    const jitterX = (seedX - 0.5) * w * 0.3;
    const jitterY = (seedY - 0.5) * h * 0.3;
    
    // Simplified rendering based on zoom and adjacency
    if (zoom < 0.5) {
      // Simplified single-pass water at low zoom
      const destWidth = w * 1.15;
      const destHeight = destWidth * aspectRatio;
      ctx.globalAlpha = 0.9;
      ctx.drawImage(
        waterImage,
        srcX, srcY, cropW, cropH,
        Math.round(tileCenterX - destWidth / 2),
        Math.round(tileCenterY - destHeight / 2),
        Math.round(destWidth),
        Math.round(destHeight)
      );
    } else if (adjacentCount >= 2) {
      // Two passes: large soft outer, smaller solid core
      const outerScale = 2.0 + adjacentCount * 0.3;
      const outerWidth = w * outerScale;
      const outerHeight = outerWidth * aspectRatio;
      ctx.globalAlpha = 0.4;
      ctx.drawImage(
        waterImage,
        srcX, srcY, cropW, cropH,
        Math.round(tileCenterX - outerWidth / 2 + jitterX * 0.5),
        Math.round(tileCenterY - outerHeight / 2 + jitterY * 0.5),
        Math.round(outerWidth),
        Math.round(outerHeight)
      );
      
      // Core pass - solid center
      const coreWidth = w * 1.2;
      const coreHeight = coreWidth * aspectRatio;
      ctx.globalAlpha = 0.85;
      ctx.drawImage(
        waterImage,
        srcX, srcY, cropW, cropH,
        Math.round(tileCenterX - coreWidth / 2 + jitterX),
        Math.round(tileCenterY - coreHeight / 2 + jitterY),
        Math.round(coreWidth),
        Math.round(coreHeight)
      );
    } else {
      // Single tile or edge - simple draw
      const destWidth = w * 1.15;
      const destHeight = destWidth * aspectRatio;
      ctx.globalAlpha = 0.9;
      ctx.drawImage(
        waterImage,
        srcX, srcY, cropW, cropH,
        Math.round(tileCenterX - destWidth / 2 + jitterX),
        Math.round(tileCenterY - destHeight / 2 + jitterY),
        Math.round(destWidth),
        Math.round(destHeight)
      );
    }
    
    ctx.globalAlpha = savedAlpha;
    ctx.restore();
  } else {
    // Fallback: solid color water if texture not loaded
    ctx.fillStyle = WATER_COLORS.base;
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y);
    ctx.lineTo(x + w, y + h / 2);
    ctx.lineTo(x + w / 2, y + h);
    ctx.lineTo(x, y + h / 2);
    ctx.closePath();
    ctx.fill();
    
    // Draw stroke when zoomed in enough
    if (zoom >= 0.6) {
      ctx.strokeStyle = WATER_COLORS.stroke;
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
  }
}

// Path colors (stone/concrete, matching road styling)
const PATH_COLORS = {
  surface: '#9ca3af',       // Main path surface
  edge: '#6b7280',          // Edge/border lines  
  centerLine: '#d1d5db',    // Light center line for decoration
};

function drawPathTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  gridX: number,
  gridY: number,
  grid: Tile[][],
  gridSize: number
) {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = x + w / 2;
  const cy = y + h / 2;

  // Check adjacent paths for connections
  const hasPath = (gx: number, gy: number) => {
    if (gx < 0 || gy < 0 || gx >= gridSize || gy >= gridSize) return false;
    return grid[gy][gx].path || grid[gy][gx].queue;
  };

  const north = hasPath(gridX - 1, gridY);
  const east = hasPath(gridX, gridY - 1);
  const south = hasPath(gridX + 1, gridY);
  const west = hasPath(gridX, gridY + 1);

  // Draw grass base first
  drawGrassTile(ctx, x, y, 1);

  // Path width ratio (similar to road system but slightly narrower)
  const pathWidthRatio = 0.14;
  const pathW = w * pathWidthRatio;
  const halfWidth = pathW * 0.5;

  // Edge stop distance (how close to tile edge the path extends)
  const edgeStop = 0.98;

  // Edge midpoints (matching road system exactly)
  const northEdgeX = x + w * 0.25;
  const northEdgeY = y + h * 0.25;
  const eastEdgeX = x + w * 0.75;
  const eastEdgeY = y + h * 0.25;
  const southEdgeX = x + w * 0.75;
  const southEdgeY = y + h * 0.75;
  const westEdgeX = x + w * 0.25;
  const westEdgeY = y + h * 0.75;

  // Direction vectors from center to each edge
  const northDx = (northEdgeX - cx) / Math.hypot(northEdgeX - cx, northEdgeY - cy);
  const northDy = (northEdgeY - cy) / Math.hypot(northEdgeX - cx, northEdgeY - cy);
  const eastDx = (eastEdgeX - cx) / Math.hypot(eastEdgeX - cx, eastEdgeY - cy);
  const eastDy = (eastEdgeY - cy) / Math.hypot(eastEdgeX - cx, eastEdgeY - cy);
  const southDx = (southEdgeX - cx) / Math.hypot(southEdgeX - cx, southEdgeY - cy);
  const southDy = (southEdgeY - cy) / Math.hypot(southEdgeX - cx, southEdgeY - cy);
  const westDx = (westEdgeX - cx) / Math.hypot(westEdgeX - cx, westEdgeY - cy);
  const westDy = (westEdgeY - cy) / Math.hypot(westEdgeX - cx, westEdgeY - cy);

  // Get perpendicular vector (like road system)
  const getPerp = (dx: number, dy: number) => ({ nx: -dy, ny: dx });

  // Draw path surface
  ctx.fillStyle = PATH_COLORS.surface;

  // Draw path segments to connected neighbors
  if (north) {
    const stopX = cx + (northEdgeX - cx) * edgeStop;
    const stopY = cy + (northEdgeY - cy) * edgeStop;
    const perp = getPerp(northDx, northDy);
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
    ctx.beginPath();
    ctx.moveTo(cx + perp.nx * halfWidth, cy + perp.ny * halfWidth);
    ctx.lineTo(stopX + perp.nx * halfWidth, stopY + perp.ny * halfWidth);
    ctx.lineTo(stopX - perp.nx * halfWidth, stopY - perp.ny * halfWidth);
    ctx.lineTo(cx - perp.nx * halfWidth, cy - perp.ny * halfWidth);
    ctx.closePath();
    ctx.fill();
  }

  // Draw edge lines for definition (like road curbs)
  ctx.strokeStyle = PATH_COLORS.edge;
  ctx.lineWidth = 0.8;
  ctx.lineCap = 'round';

  // Draw edge lines along each path segment
  const drawPathEdges = (
    dirDx: number,
    dirDy: number,
    edgeX: number,
    edgeY: number
  ) => {
    const perp = getPerp(dirDx, dirDy);
    const stopX = cx + (edgeX - cx) * edgeStop;
    const stopY = cy + (edgeY - cy) * edgeStop;

    // Left edge
    ctx.beginPath();
    ctx.moveTo(cx + perp.nx * halfWidth, cy + perp.ny * halfWidth);
    ctx.lineTo(stopX + perp.nx * halfWidth, stopY + perp.ny * halfWidth);
    ctx.stroke();

    // Right edge
    ctx.beginPath();
    ctx.moveTo(cx - perp.nx * halfWidth, cy - perp.ny * halfWidth);
    ctx.lineTo(stopX - perp.nx * halfWidth, stopY - perp.ny * halfWidth);
    ctx.stroke();
  };

  if (north) drawPathEdges(northDx, northDy, northEdgeX, northEdgeY);
  if (east) drawPathEdges(eastDx, eastDy, eastEdgeX, eastEdgeY);
  if (south) drawPathEdges(southDx, southDy, southEdgeX, southEdgeY);
  if (west) drawPathEdges(westDx, westDy, westEdgeX, westEdgeY);
}

// Queue colors - RCT-style stanchion barriers
const QUEUE_COLORS = {
  // Path surface (slightly different from regular path)
  surface: '#a1a1aa',       // Lighter concrete for queue areas
  surfaceEdge: '#71717a',   // Edge color
  // Stanchion posts (chrome/metal look)
  postBase: '#52525b',      // Dark base
  postPole: '#a1a1aa',      // Silver pole
  postTop: '#d4d4d8',       // Bright top cap
  postShadow: 'rgba(0,0,0,0.3)',
  // Retractable belt barrier
  beltColor: '#dc2626',     // Red belt (classic queue color)
  beltShadow: '#991b1b',    // Darker red for depth
};

function drawQueueTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  gridX: number,
  gridY: number,
  grid: Tile[][],
  gridSize: number
) {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = x + w / 2;
  const cy = y + h / 2;

  // Check adjacent paths for connections
  const hasPath = (gx: number, gy: number) => {
    if (gx < 0 || gy < 0 || gx >= gridSize || gy >= gridSize) return false;
    return grid[gy][gx].path || grid[gy][gx].queue;
  };

  const north = hasPath(gridX - 1, gridY);
  const east = hasPath(gridX, gridY - 1);
  const south = hasPath(gridX + 1, gridY);
  const west = hasPath(gridX, gridY + 1);

  // Draw grass base first
  drawGrassTile(ctx, x, y, 1);

  // Queue path dimensions (same as regular path)
  const pathWidthRatio = 0.14;
  const pathW = w * pathWidthRatio;
  const halfWidth = pathW * 0.5;
  const edgeStop = 0.98;

  // Edge midpoints
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

  // Draw queue path surface (slightly different color than regular path)
  ctx.fillStyle = QUEUE_COLORS.surface;

  if (north) {
    const stopX = cx + (northEdgeX - cx) * edgeStop;
    const stopY = cy + (northEdgeY - cy) * edgeStop;
    const perp = getPerp(northDx, northDy);
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
    ctx.beginPath();
    ctx.moveTo(cx + perp.nx * halfWidth, cy + perp.ny * halfWidth);
    ctx.lineTo(stopX + perp.nx * halfWidth, stopY + perp.ny * halfWidth);
    ctx.lineTo(stopX - perp.nx * halfWidth, stopY - perp.ny * halfWidth);
    ctx.lineTo(cx - perp.nx * halfWidth, cy - perp.ny * halfWidth);
    ctx.closePath();
    ctx.fill();
  }

  // Draw path edge lines
  ctx.strokeStyle = QUEUE_COLORS.surfaceEdge;
  ctx.lineWidth = 0.8;
  ctx.lineCap = 'round';

  const drawEdgeLine = (dirDx: number, dirDy: number, edgeX: number, edgeY: number) => {
    const perp = getPerp(dirDx, dirDy);
    const stopX = cx + (edgeX - cx) * edgeStop;
    const stopY = cy + (edgeY - cy) * edgeStop;
    ctx.beginPath();
    ctx.moveTo(cx + perp.nx * halfWidth, cy + perp.ny * halfWidth);
    ctx.lineTo(stopX + perp.nx * halfWidth, stopY + perp.ny * halfWidth);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - perp.nx * halfWidth, cy - perp.ny * halfWidth);
    ctx.lineTo(stopX - perp.nx * halfWidth, stopY - perp.ny * halfWidth);
    ctx.stroke();
  };

  if (north) drawEdgeLine(northDx, northDy, northEdgeX, northEdgeY);
  if (east) drawEdgeLine(eastDx, eastDy, eastEdgeX, eastEdgeY);
  if (south) drawEdgeLine(southDx, southDy, southEdgeX, southEdgeY);
  if (west) drawEdgeLine(westDx, westDy, westEdgeX, westEdgeY);

  // Queue barrier dimensions
  const barrierOffset = halfWidth + 2; // Position barriers just outside the path
  const postSpacing = 14; // Distance between stanchion posts
  const postHeight = 6;   // Visual height of posts (isometric)
  const postRadius = 1.2; // Radius of the pole

  // Collect all post positions for depth-sorted rendering
  const posts: { x: number; y: number; depth: number }[] = [];

  // Draw queue barriers (stanchions with belt)
  const drawQueueBarrierSegment = (
    dirDx: number, 
    dirDy: number, 
    edgeX: number, 
    edgeY: number
  ) => {
    const perp = getPerp(dirDx, dirDy);
    const stopX = cx + (edgeX - cx) * edgeStop;
    const stopY = cy + (edgeY - cy) * edgeStop;
    const segLen = Math.hypot(stopX - cx, stopY - cy);
    const numPosts = Math.max(2, Math.floor(segLen / postSpacing) + 1);

    // Draw belts first (behind posts)
    for (const side of [-1, 1]) {
      const railOffX = perp.nx * barrierOffset * side;
      const railOffY = perp.ny * barrierOffset * side;
      const startX = cx + railOffX;
      const startY = cy + railOffY;
      const endX = stopX + railOffX;
      const endY = stopY + railOffY;

      // Belt shadow (lower)
      ctx.strokeStyle = QUEUE_COLORS.beltShadow;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(startX, startY - postHeight * 0.4);
      ctx.lineTo(endX, endY - postHeight * 0.4);
      ctx.stroke();

      // Main red belt (slightly higher to create 3D effect)
      ctx.strokeStyle = QUEUE_COLORS.beltColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(startX, startY - postHeight * 0.5);
      ctx.lineTo(endX, endY - postHeight * 0.5);
      ctx.stroke();

      // Collect post positions
      for (let i = 0; i < numPosts; i++) {
        const t = numPosts > 1 ? i / (numPosts - 1) : 0.5;
        const postX = startX + (endX - startX) * t;
        const postY = startY + (endY - startY) * t;
        posts.push({ x: postX, y: postY, depth: postY });
      }
    }
  };

  // Draw barriers for each connected direction
  if (north) drawQueueBarrierSegment(northDx, northDy, northEdgeX, northEdgeY);
  if (east) drawQueueBarrierSegment(eastDx, eastDy, eastEdgeX, eastEdgeY);
  if (south) drawQueueBarrierSegment(southDx, southDy, southEdgeX, southEdgeY);
  if (west) drawQueueBarrierSegment(westDx, westDy, westEdgeX, westEdgeY);

  // Sort posts by depth (back to front) for proper rendering
  posts.sort((a, b) => a.depth - b.depth);

  // Draw all stanchion posts
  for (const post of posts) {
    const px = post.x;
    const py = post.y;

    // Post shadow on ground
    ctx.fillStyle = QUEUE_COLORS.postShadow;
    ctx.beginPath();
    ctx.ellipse(px + 1, py + 1, postRadius * 1.5, postRadius * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Base (dark disk at ground level)
    ctx.fillStyle = QUEUE_COLORS.postBase;
    ctx.beginPath();
    ctx.ellipse(px, py, postRadius * 1.8, postRadius * 1, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pole (vertical line going up)
    ctx.strokeStyle = QUEUE_COLORS.postPole;
    ctx.lineWidth = postRadius * 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px, py - postHeight);
    ctx.stroke();

    // Pole highlight (lighter edge for 3D effect)
    ctx.strokeStyle = QUEUE_COLORS.postTop;
    ctx.lineWidth = postRadius * 0.8;
    ctx.beginPath();
    ctx.moveTo(px - postRadius * 0.3, py - 1);
    ctx.lineTo(px - postRadius * 0.3, py - postHeight + 1);
    ctx.stroke();

    // Top cap (bright circle at top of post)
    ctx.fillStyle = QUEUE_COLORS.postTop;
    ctx.beginPath();
    ctx.arc(px, py - postHeight, postRadius * 1.2, 0, Math.PI * 2);
    ctx.fill();
    
    // Top cap highlight
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(px - postRadius * 0.3, py - postHeight - postRadius * 0.3, postRadius * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.setLineDash([]);
}

// Check if a building type is a tree (for multi-tree rendering)
function isTreeType(buildingType: string): boolean {
  return buildingType.startsWith('tree_');
}

// Seeded random for consistent tree placement per tile
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

function drawSprite(
  ctx: CanvasRenderingContext2D,
  spriteSheets: Map<string, HTMLCanvasElement>,
  buildingType: string,
  x: number,
  y: number,
  gridX?: number,
  gridY?: number
) {
  const info = getSpriteInfo(buildingType);
  if (!info) return false;
  
  const { sheet, sprite } = info;
  const sheetCanvas = spriteSheets.get(sheet.id);
  if (!sheetCanvas) return false;
  
  const rect = getSpriteRect(sheet, sprite, sheetCanvas.width, sheetCanvas.height);
  const baseScale = sprite.scale || 1.0;
  
  // Check if this is a tree - if so, draw multiple trees
  if (isTreeType(buildingType) && gridX !== undefined && gridY !== undefined) {
    const numTrees = 3 + Math.floor(seededRandom(gridX * 1000 + gridY)() * 3); // 3-5 trees
    const rand = seededRandom(gridX * 997 + gridY * 1009);
    
    // Generate tree positions sorted by Y for proper depth ordering
    const treePositions: { offsetX: number; offsetY: number; scale: number; depth: number }[] = [];
    
    for (let i = 0; i < numTrees; i++) {
      // Random position within the isometric tile diamond
      // Use parametric coordinates and convert to isometric
      const u = rand() * 0.7 + 0.15; // 0.15 to 0.85 to stay within tile
      const v = rand() * 0.7 + 0.15;
      
      // Convert to isometric offsets from tile center
      const isoOffsetX = (u - v) * (TILE_WIDTH * 0.35);
      const isoOffsetY = (u + v - 1) * (TILE_HEIGHT * 0.35);
      
      // Random scale variation (80% to 110% of base scale)
      const scaleVariation = 0.8 + rand() * 0.3;
      
      treePositions.push({
        offsetX: isoOffsetX,
        offsetY: isoOffsetY,
        scale: baseScale * scaleVariation,
        depth: isoOffsetY, // Sort by Y for proper overlap
      });
    }
    
    // Sort by depth (trees further back drawn first)
    treePositions.sort((a, b) => a.depth - b.depth);
    
    // Draw each tree
    for (const tree of treePositions) {
      const scale = tree.scale;
      const baseWidth = TILE_WIDTH * 1.2;
      const destWidth = baseWidth * scale;
      const aspectRatio = rect.sh / rect.sw;
      const destHeight = destWidth * aspectRatio;
      
      const offsetScale = destWidth / rect.sw;
      const spriteOffsetX = (sprite.offsetX || 0) * offsetScale;
      const spriteOffsetY = (sprite.offsetY || 0) * offsetScale;
      
      const drawX = x + (TILE_WIDTH - destWidth) / 2 + spriteOffsetX + tree.offsetX;
      const drawY = y + TILE_HEIGHT - destHeight + spriteOffsetY + tree.offsetY;
      
      ctx.drawImage(
        sheetCanvas,
        rect.sx, rect.sy, rect.sw, rect.sh,
        drawX, drawY, destWidth, destHeight
      );
    }
    
    return true;
  }
  
  // Standard single sprite rendering
  const scale = baseScale;
  const baseWidth = TILE_WIDTH * 1.2;
  const destWidth = baseWidth * scale;
  
  const aspectRatio = rect.sh / rect.sw;
  const destHeight = destWidth * aspectRatio;
  
  const offsetScale = destWidth / rect.sw;
  const offsetX = (sprite.offsetX || 0) * offsetScale;
  const offsetY = (sprite.offsetY || 0) * offsetScale;
  
  const drawX = x + (TILE_WIDTH - destWidth) / 2 + offsetX;
  const drawY = y + TILE_HEIGHT - destHeight + offsetY;
  
  ctx.drawImage(
    sheetCanvas,
    rect.sx, rect.sy, rect.sw, rect.sh,
    drawX, drawY, destWidth, destHeight
  );
  
  return true;
}

function drawTrackSegment(
  ctx: CanvasRenderingContext2D,
  trackPiece: Tile['trackPiece'],
  x: number,
  y: number,
  tick: number
) {
  if (!trackPiece) return;
  
  const { type, direction, startHeight, endHeight, chainLift } = trackPiece;
  
  if (type === 'straight_flat' || type === 'lift_hill_start' || type === 'lift_hill_middle' || type === 'lift_hill_end') {
    drawStraightTrack(ctx, x, y, direction, startHeight);
  } else if (type === 'turn_left_flat' || type === 'turn_right_flat') {
    drawCurvedTrack(ctx, x, y, direction, type === 'turn_right_flat', startHeight);
  } else if (type === 'slope_up_small' || type === 'slope_down_small') {
    drawSlopeTrack(ctx, x, y, direction, startHeight, endHeight);
  } else if (type === 'loop_vertical') {
    drawLoopTrack(ctx, x, y, direction, Math.max(3, endHeight + 3));
  } else {
    // Default fallback to straight for unimplemented pieces
    drawStraightTrack(ctx, x, y, direction, startHeight);
  }
  
  // Only draw chain lift on slope_up pieces (never on slope_down)
  // Chain lifts pull the coaster UP, not down
  const shouldDrawChain = chainLift && type === 'slope_up_small';
  if (shouldDrawChain) {
    drawChainLift(ctx, x, y, direction, startHeight, endHeight, tick);
  }
}

/**
 * Get a point along a track piece at parameter t (0 to 1)
 * Uses the SAME geometry as the track drawing functions
 */
function getTrackPoint(
  trackPiece: NonNullable<Tile['trackPiece']>,
  centerX: number,
  centerY: number,
  t: number
): { x: number; y: number } {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  
  // Use the same edge midpoints as track drawing
  const startX = centerX - w / 2;
  const startY = centerY - h / 2;
  
  const heightOffset = (trackPiece.startHeight + (trackPiece.endHeight - trackPiece.startHeight) * t) * HEIGHT_UNIT;
  
  // Edge midpoints - MUST match track drawing exactly
  const northEdge = { x: startX + w * 0.25, y: startY + h * 0.25 - heightOffset };
  const eastEdge = { x: startX + w * 0.75, y: startY + h * 0.25 - heightOffset };
  const southEdge = { x: startX + w * 0.75, y: startY + h * 0.75 - heightOffset };
  const westEdge = { x: startX + w * 0.25, y: startY + h * 0.75 - heightOffset };
  const center = { x: startX + w / 2, y: startY + h / 2 - heightOffset };
  
  const { type, direction } = trackPiece;
  
  if (type === 'turn_left_flat' || type === 'turn_right_flat') {
    const turnRight = type === 'turn_right_flat';
    
    // Determine which edges to connect based on direction and turn
    // This MUST match drawCurvedTrack logic exactly
    let fromEdge: { x: number; y: number };
    let toEdge: { x: number; y: number };
    
    if (direction === 'north') {
      fromEdge = northEdge;
      toEdge = turnRight ? eastEdge : westEdge;
    } else if (direction === 'south') {
      fromEdge = southEdge;
      toEdge = turnRight ? westEdge : eastEdge;
    } else if (direction === 'east') {
      fromEdge = eastEdge;
      toEdge = turnRight ? southEdge : northEdge;
    } else { // west
      fromEdge = westEdge;
      toEdge = turnRight ? northEdge : southEdge;
    }
    
    // Quadratic bezier with center as control point (same as drawCurvedTrack)
    const u = 1 - t;
    return {
      x: u * u * fromEdge.x + 2 * u * t * center.x + t * t * toEdge.x,
      y: u * u * fromEdge.y + 2 * u * t * center.y + t * t * toEdge.y,
    };
  }
  
  if (type === 'loop_vertical') {
    // Match the loop drawing logic
    const loopRadius = Math.max(28, (trackPiece.endHeight + 3) * HEIGHT_UNIT * 0.4);
    const angle = t * Math.PI * 2;
    const forwardOffset = Math.sin(angle) * loopRadius;
    const vertOffset = (1 - Math.cos(angle)) * loopRadius;
    
    // Get direction vector
    const dirVectors: Record<string, { dx: number; dy: number }> = {
      north: { dx: -0.5, dy: -0.5 },
      south: { dx: 0.5, dy: 0.5 },
      east: { dx: 0.5, dy: -0.5 },
      west: { dx: -0.5, dy: 0.5 },
    };
    const dir = dirVectors[direction] || { dx: 0.5, dy: 0.5 };
    
    return {
      x: center.x + dir.dx * forwardOffset,
      y: center.y + dir.dy * forwardOffset - vertOffset,
    };
  }
  
  // Straight or slope segments - use edge midpoints
  // Direction determines which way the train travels through the tile
  // North/South tracks go diagonally from top-left to bottom-right
  // East/West tracks go diagonally from top-right to bottom-left
  
  if (direction === 'south') {
    // South: enter from north edge (top-left), exit to south edge (bottom-right)
    const fromX = startX + w * 0.25;
    const fromY = startY + h * 0.25 - trackPiece.startHeight * HEIGHT_UNIT;
    const toX = startX + w * 0.75;
    const toY = startY + h * 0.75 - trackPiece.endHeight * HEIGHT_UNIT;
    return { x: fromX + (toX - fromX) * t, y: fromY + (toY - fromY) * t };
  } else if (direction === 'north') {
    // North: enter from south edge (bottom-right), exit to north edge (top-left)
    const fromX = startX + w * 0.75;
    const fromY = startY + h * 0.75 - trackPiece.startHeight * HEIGHT_UNIT;
    const toX = startX + w * 0.25;
    const toY = startY + h * 0.25 - trackPiece.endHeight * HEIGHT_UNIT;
    return { x: fromX + (toX - fromX) * t, y: fromY + (toY - fromY) * t };
  } else if (direction === 'west') {
    // West: enter from east edge (top-right), exit to west edge (bottom-left)
    const fromX = startX + w * 0.75;
    const fromY = startY + h * 0.25 - trackPiece.startHeight * HEIGHT_UNIT;
    const toX = startX + w * 0.25;
    const toY = startY + h * 0.75 - trackPiece.endHeight * HEIGHT_UNIT;
    return { x: fromX + (toX - fromX) * t, y: fromY + (toY - fromY) * t };
  } else {
    // East: enter from west edge (bottom-left), exit to east edge (top-right)
    const fromX = startX + w * 0.25;
    const fromY = startY + h * 0.75 - trackPiece.startHeight * HEIGHT_UNIT;
    const toX = startX + w * 0.75;
    const toY = startY + h * 0.25 - trackPiece.endHeight * HEIGHT_UNIT;
    return { x: fromX + (toX - fromX) * t, y: fromY + (toY - fromY) * t };
  }
}

// Direction angles for isometric view (matching train system)
const DIRECTION_ANGLES: Record<string, number> = {
  north: Math.atan2(-TILE_HEIGHT / 2, -TILE_WIDTH / 2),
  south: Math.atan2(TILE_HEIGHT / 2, TILE_WIDTH / 2),
  east: Math.atan2(-TILE_HEIGHT / 2, TILE_WIDTH / 2),
  west: Math.atan2(TILE_HEIGHT / 2, -TILE_WIDTH / 2),
};

function drawCoasterCar(ctx: CanvasRenderingContext2D, x: number, y: number, direction: string) {
  const angle = DIRECTION_ANGLES[direction] ?? 0;
  
  // Car dimensions - scaled down by 30%
  const carLength = 10;
  const carWidth = 2.8;
  
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  
  // Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 4, carLength * 0.45, carWidth * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Main body (red)
  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  ctx.moveTo(-carLength * 0.45, -carWidth);
  ctx.lineTo(carLength * 0.35, -carWidth);
  ctx.lineTo(carLength * 0.45, -carWidth * 0.5);
  ctx.lineTo(carLength * 0.45, carWidth * 0.5);
  ctx.lineTo(carLength * 0.35, carWidth);
  ctx.lineTo(-carLength * 0.45, carWidth);
  ctx.closePath();
  ctx.fill();
  
  // Darker back section
  ctx.fillStyle = '#b91c1c';
  ctx.fillRect(-carLength * 0.45, -carWidth * 0.8, carLength * 0.25, carWidth * 1.6);
  
  // Yellow stripe/highlight
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(-carLength * 0.15, -carWidth * 0.9, carLength * 0.4, carWidth * 0.3);
  ctx.fillRect(-carLength * 0.15, carWidth * 0.6, carLength * 0.4, carWidth * 0.3);
  
  // Front detail
  ctx.fillStyle = '#1f2937';
  ctx.beginPath();
  ctx.arc(carLength * 0.3, 0, carWidth * 0.4, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.restore();
}

// =============================================================================
// COMPONENT
// =============================================================================

interface CoasterGridProps {
  selectedTile: { x: number; y: number } | null;
  setSelectedTile: (tile: { x: number; y: number } | null) => void;
  navigationTarget?: { x: number; y: number } | null;
  onNavigationComplete?: () => void;
  onViewportChange?: (viewport: {
    offset: { x: number; y: number };
    zoom: number;
    canvasSize: { width: number; height: number };
  }) => void;
}

export function CoasterGrid({
  selectedTile,
  setSelectedTile,
  navigationTarget,
  onNavigationComplete,
  onViewportChange,
}: CoasterGridProps) {
  const { state, latestStateRef, placeAtTile, bulldozeTile, placeTrackLine } = useCoaster();
  const { grid, gridSize, selectedTool, tick } = state;
  
  // Check if current tool supports drag-to-draw
  const isTrackDragTool = useMemo(() => TRACK_DRAG_TOOLS.includes(selectedTool), [selectedTool]);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [offset, setOffset] = useState({ x: 620, y: 160 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredTile, setHoveredTile] = useState<{ x: number; y: number } | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [spriteSheets, setSpriteSheets] = useState<Map<string, HTMLCanvasElement>>(new Map());
  const [waterImage, setWaterImage] = useState<HTMLImageElement | null>(null);
  
  // Track drag state (for drag-to-draw track/path)
  const [isTrackDragging, setIsTrackDragging] = useState(false);
  const [trackDragStartTile, setTrackDragStartTile] = useState<{ x: number; y: number } | null>(null);
  const [trackDragDirection, setTrackDragDirection] = useState<'h' | 'v' | null>(null);
  const [trackDragPreviewTiles, setTrackDragPreviewTiles] = useState<{ x: number; y: number }[]>([]);
  const placedTrackTilesRef = useRef<Set<string>>(new Set());
  
  // Load sprite sheets
  useEffect(() => {
    const loadSheets = async () => {
      const newSheets = new Map<string, HTMLCanvasElement>();
      
      for (const sheet of COASTER_SPRITE_PACK.sheets) {
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          
          await new Promise<void>((resolve, reject) => {
            img.onload = () => {
              const filtered = filterBackgroundColor(img);
              newSheets.set(sheet.id, filtered);
              resolve();
            };
            img.onerror = reject;
            img.src = sheet.src;
          });
        } catch (e) {
          console.error(`Failed to load sprite sheet ${sheet.id}:`, e);
        }
      }
      
      setSpriteSheets(newSheets);
    };
    
    loadSheets();
  }, []);
  
  // Load water texture
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => setWaterImage(img);
    img.onerror = () => console.error('Failed to load water texture');
    img.src = WATER_ASSET_PATH;
  }, []);
  
  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setCanvasSize({ width: rect.width, height: rect.height });
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Report viewport changes
  useEffect(() => {
    onViewportChange?.({ offset, zoom, canvasSize });
  }, [offset, zoom, canvasSize, onViewportChange]);
  
  // Navigate to target
  useEffect(() => {
    if (navigationTarget) {
      const { screenX, screenY } = gridToScreen(
        navigationTarget.x,
        navigationTarget.y,
        0,
        0
      );
      setOffset({
        x: canvasSize.width / 2 - screenX * zoom,
        y: canvasSize.height / 2 - screenY * zoom,
      });
      onNavigationComplete?.();
    }
  }, [navigationTarget, canvasSize, zoom, onNavigationComplete]);
  
  // Main render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasSize.width * dpr;
    canvas.height = canvasSize.height * dpr;
    canvas.style.width = `${canvasSize.width}px`;
    canvas.style.height = `${canvasSize.height}px`;
    
    // Clear
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Apply transforms
    ctx.save();
    ctx.scale(dpr * zoom, dpr * zoom);
    ctx.translate(offset.x / zoom, offset.y / zoom);
    
    // Calculate visible bounds for culling
    const viewLeft = -offset.x / zoom - TILE_WIDTH;
    const viewTop = -offset.y / zoom - TILE_HEIGHT;
    const viewRight = canvasSize.width / zoom - offset.x / zoom + TILE_WIDTH;
    const viewBottom = canvasSize.height / zoom - offset.y / zoom + TILE_HEIGHT;
    
    const guestsByTile = new Map<string, typeof state.guests>();
    state.guests.forEach(guest => {
      const key = `${guest.tileX},${guest.tileY}`;
      const existing = guestsByTile.get(key);
      if (existing) {
        existing.push(guest);
      } else {
        guestsByTile.set(key, [guest]);
      }
    });
    
    const carsByTile = new Map<string, { x: number; y: number; direction: string }[]>();
    state.coasters.forEach(coaster => {
      if (coaster.track.length === 0 || coaster.trackTiles.length === 0) return;
      const trackLen = coaster.track.length;
      
      coaster.trains.forEach(train => {
        train.cars.forEach(car => {
          // Handle negative track progress by wrapping around
          let normalizedProgress = car.trackProgress % trackLen;
          if (normalizedProgress < 0) normalizedProgress += trackLen;
          
          const trackIndex = Math.floor(normalizedProgress);
          const t = normalizedProgress - trackIndex;
          const trackTile = coaster.trackTiles[trackIndex];
          const trackPiece = coaster.track[trackIndex];
          if (!trackTile || !trackPiece) return;

          const { screenX, screenY } = gridToScreen(trackTile.x, trackTile.y, 0, 0);
          const centerX = screenX + TILE_WIDTH / 2;
          const centerY = screenY + TILE_HEIGHT / 2;
          const pos = getTrackPoint(trackPiece, centerX, centerY, t);

          const key = `${trackTile.x},${trackTile.y}`;
          const existing = carsByTile.get(key);
          const carData = { ...pos, direction: trackPiece.direction };
          if (existing) {
            existing.push(carData);
          } else {
            carsByTile.set(key, [carData]);
          }
        });
      });
    });
    
    // Draw tiles (back to front for proper depth)
    for (let sum = 0; sum < gridSize * 2 - 1; sum++) {
      for (let x = 0; x <= sum; x++) {
        const y = sum - x;
        if (x >= gridSize || y >= gridSize || y < 0) continue;
        
        const { screenX, screenY } = gridToScreen(x, y, 0, 0);
        
        // Culling
        if (screenX < viewLeft || screenX > viewRight ||
            screenY < viewTop || screenY > viewBottom) continue;
        
const tile = grid[y][x];

        // Draw based on tile type
        if (tile.terrain === 'water') {
          drawWaterTile(ctx, screenX, screenY, x, y, grid, gridSize, waterImage, zoom);
        } else if (tile.queue) {
          drawQueueTile(ctx, screenX, screenY, x, y, grid, gridSize);
        } else if (tile.path) {
          drawPathTile(ctx, screenX, screenY, x, y, grid, gridSize);
        } else {
          drawGrassTile(ctx, screenX, screenY, zoom);
        }
        
        // Draw coaster track if present
        if (tile.trackPiece) {
          drawTrackSegment(ctx, tile.trackPiece, screenX, screenY, tick);
        }
        
        // Draw building sprite if present
        const buildingType = tile.building?.type;
        if (buildingType && buildingType !== 'empty' && buildingType !== 'grass' &&
            buildingType !== 'water' && buildingType !== 'path' && buildingType !== 'queue') {
          drawSprite(ctx, spriteSheets, buildingType, screenX, screenY, x, y);
        }
        
        // Draw guests on this tile
        const guests = guestsByTile.get(`${x},${y}`);
        if (guests) {
          guests.forEach(guest => {
            drawGuest(ctx, guest, tick);
          });
        }

        // Draw coaster cars on this tile
        const cars = carsByTile.get(`${x},${y}`);
        if (cars) {
          cars.forEach(car => {
            drawCoasterCar(ctx, car.x, car.y, car.direction);
          });
        }
        
        // Selection highlight
        if (selectedTile && selectedTile.x === x && selectedTile.y === y) {
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(screenX + TILE_WIDTH / 2, screenY);
          ctx.lineTo(screenX + TILE_WIDTH, screenY + TILE_HEIGHT / 2);
          ctx.lineTo(screenX + TILE_WIDTH / 2, screenY + TILE_HEIGHT);
          ctx.lineTo(screenX, screenY + TILE_HEIGHT / 2);
          ctx.closePath();
          ctx.stroke();
        }
        
        // Track drag preview highlight (blue tint for preview tiles)
        const isPreviewTile = trackDragPreviewTiles.some(t => t.x === x && t.y === y);
        if (isPreviewTile && isTrackDragging) {
          ctx.fillStyle = 'rgba(59, 130, 246, 0.4)';
          ctx.beginPath();
          ctx.moveTo(screenX + TILE_WIDTH / 2, screenY);
          ctx.lineTo(screenX + TILE_WIDTH, screenY + TILE_HEIGHT / 2);
          ctx.lineTo(screenX + TILE_WIDTH / 2, screenY + TILE_HEIGHT);
          ctx.lineTo(screenX, screenY + TILE_HEIGHT / 2);
          ctx.closePath();
          ctx.fill();
        }
        
      }
    }
    
    // Draw hover highlights AFTER all tiles (so they appear on top)
    // Helper to draw an isometric diamond highlight
    const drawHighlight = (sx: number, sy: number, fillColor = 'rgba(251, 191, 36, 0.3)', strokeColor = '#fbbf24') => {
      ctx.fillStyle = fillColor;
      ctx.beginPath();
      ctx.moveTo(sx + TILE_WIDTH / 2, sy);
      ctx.lineTo(sx + TILE_WIDTH, sy + TILE_HEIGHT / 2);
      ctx.lineTo(sx + TILE_WIDTH / 2, sy + TILE_HEIGHT);
      ctx.lineTo(sx, sy + TILE_HEIGHT / 2);
      ctx.closePath();
      ctx.fill();
      
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2;
      ctx.stroke();
    };
    
    // Draw hovered tile highlight with multi-tile preview for buildings
    if (hoveredTile && hoveredTile.x >= 0 && hoveredTile.x < gridSize && 
        hoveredTile.y >= 0 && hoveredTile.y < gridSize && selectedTool !== 'select') {
      
      // Check if we're not in track drag preview mode
      const isPreviewTile = trackDragPreviewTiles.some(t => t.x === hoveredTile.x && t.y === hoveredTile.y);
      if (!isPreviewTile) {
        // Get the building size for the current tool
        const buildingSize = getToolBuildingSize(selectedTool);
        
        // Draw highlight for each tile in the building footprint
        for (let dx = 0; dx < buildingSize.width; dx++) {
          for (let dy = 0; dy < buildingSize.height; dy++) {
            const tx = hoveredTile.x + dx;
            const ty = hoveredTile.y + dy;
            if (tx >= 0 && tx < gridSize && ty >= 0 && ty < gridSize) {
              const { screenX, screenY } = gridToScreen(tx, ty, 0, 0);
              drawHighlight(screenX, screenY);
            }
          }
        }
      }
    }
    
    ctx.restore();
  }, [grid, gridSize, offset, zoom, canvasSize, tick, selectedTile, hoveredTile, selectedTool, spriteSheets, waterImage, state.guests, state.coasters, trackDragPreviewTiles, isTrackDragging]);
  
  // Helper to calculate tiles in a line from start to end (with direction locking)
  const calculateLineTiles = useCallback((
    start: { x: number; y: number },
    end: { x: number; y: number },
    direction: 'h' | 'v' | null
  ): { x: number; y: number }[] => {
    const tiles: { x: number; y: number }[] = [];
    
    // Lock to direction
    let targetX = end.x;
    let targetY = end.y;
    if (direction === 'h') {
      targetY = start.y;
    } else if (direction === 'v') {
      targetX = start.x;
    }
    
    // Calculate step direction
    const dx = targetX - start.x;
    const dy = targetY - start.y;
    const steps = Math.max(Math.abs(dx), Math.abs(dy));
    
    if (steps === 0) {
      tiles.push({ x: start.x, y: start.y });
      return tiles;
    }
    
    const stepX = dx / steps;
    const stepY = dy / steps;
    
    for (let i = 0; i <= steps; i++) {
      const x = Math.round(start.x + stepX * i);
      const y = Math.round(start.y + stepY * i);
      if (x >= 0 && y >= 0 && x < gridSize && y < gridSize) {
        // Avoid duplicates
        if (tiles.length === 0 || tiles[tiles.length - 1].x !== x || tiles[tiles.length - 1].y !== y) {
          tiles.push({ x, y });
        }
      }
    }
    
    return tiles;
  }, [gridSize]);
  
  // Mouse handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Middle mouse button or left click + Alt/Option key = force pan mode
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
      e.preventDefault();
      return;
    }
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Get the tile under the mouse
    const { gridX, gridY } = screenToGrid(
      mouseX / zoom,
      mouseY / zoom,
      offset.x / zoom,
      offset.y / zoom
    );
    
    const isValidTile = gridX >= 0 && gridX < gridSize && gridY >= 0 && gridY < gridSize;
    
    // If clicking outside the grid, start panning
    if (!isValidTile) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
      return;
    }
    
    // If it's a track drag tool and we're on a valid tile, start track dragging
    if (isTrackDragTool && isValidTile) {
      setIsTrackDragging(true);
      setTrackDragStartTile({ x: gridX, y: gridY });
      setTrackDragDirection(null);
      setTrackDragPreviewTiles([{ x: gridX, y: gridY }]);
      placedTrackTilesRef.current.clear();
      placedTrackTilesRef.current.add(`${gridX},${gridY}`);
      // Place or bulldoze immediately on first click
      if (selectedTool === 'bulldoze') {
        bulldozeTile(gridX, gridY);
      } else {
        placeAtTile(gridX, gridY);
      }
    } else if (selectedTool === 'select') {
      // Select tool just selects, doesn't pan
      setSelectedTile({ x: gridX, y: gridY });
    } else {
      // Other tools (shops, decorations, etc.) - place on click
      placeAtTile(gridX, gridY);
    }
  }, [offset, zoom, gridSize, isTrackDragTool, selectedTool, placeAtTile, bulldozeTile, setSelectedTile]);
  
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Get the tile under the mouse
    const { gridX, gridY } = screenToGrid(
      mouseX / zoom,
      mouseY / zoom,
      offset.x / zoom,
      offset.y / zoom
    );
    
    // Update hovered tile
    if (gridX >= 0 && gridX < gridSize && gridY >= 0 && gridY < gridSize) {
      setHoveredTile({ x: gridX, y: gridY });
    } else {
      setHoveredTile(null);
    }
    
    if (isTrackDragging && trackDragStartTile) {
      // Track dragging mode
      const dx = Math.abs(gridX - trackDragStartTile.x);
      const dy = Math.abs(gridY - trackDragStartTile.y);
      
      // Lock direction after moving at least 1 tile
      let direction = trackDragDirection;
      if (!direction && (dx > 0 || dy > 0)) {
        direction = dx >= dy ? 'h' : 'v';
        setTrackDragDirection(direction);
      }
      
      // Calculate tiles along the locked axis
      const lineTiles = calculateLineTiles(trackDragStartTile, { x: gridX, y: gridY }, direction);
      setTrackDragPreviewTiles(lineTiles);
      
      // Place track or bulldoze on new tiles as we drag
      for (const tile of lineTiles) {
        const key = `${tile.x},${tile.y}`;
        if (!placedTrackTilesRef.current.has(key)) {
          placedTrackTilesRef.current.add(key);
          if (selectedTool === 'bulldoze') {
            bulldozeTile(tile.x, tile.y);
          } else {
            placeAtTile(tile.x, tile.y);
          }
        }
      }
    } else if (isDragging) {
      // View panning mode
      setOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  }, [isDragging, isTrackDragging, dragStart, offset, zoom, gridSize, trackDragStartTile, trackDragDirection, calculateLineTiles, placeAtTile, bulldozeTile, selectedTool]);
  
  const handleMouseUp = useCallback(() => {
    if (isTrackDragging) {
      // Finish track dragging
      setIsTrackDragging(false);
      setTrackDragStartTile(null);
      setTrackDragDirection(null);
      setTrackDragPreviewTiles([]);
      placedTrackTilesRef.current.clear();
      return;
    }
    
    // End view panning
    setIsDragging(false);
  }, [isTrackDragging]);
  
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom * zoomFactor));
    
    // Zoom toward mouse position
    const zoomRatio = newZoom / zoom;
    setOffset({
      x: mouseX - (mouseX - offset.x) * zoomRatio,
      y: mouseY - (mouseY - offset.y) * zoomRatio,
    });
    setZoom(newZoom);
  }, [zoom, offset]);
  
  return (
    <div ref={containerRef} className="w-full h-full">
      <canvas
        ref={canvasRef}
        className="block cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          setIsDragging(false);
          setIsTrackDragging(false);
          setTrackDragStartTile(null);
          setTrackDragDirection(null);
          setTrackDragPreviewTiles([]);
          placedTrackTilesRef.current.clear();
          setHoveredTile(null);
        }}
        onWheel={handleWheel}
      />
    </div>
  );
}
