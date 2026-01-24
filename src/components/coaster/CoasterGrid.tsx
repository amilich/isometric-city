'use client';

import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { useCoaster } from '@/context/CoasterContext';
import { Tile, Tool, TOOL_INFO } from '@/games/coaster/types';
import { getCoasterCategory, CoasterCategory, CoasterType } from '@/games/coaster/types/tracks';
import { getSpriteInfo, getSpriteRect, COASTER_SPRITE_PACK } from '@/games/coaster/lib/coasterRenderConfig';

// Helper to get building size for a tool (defaults to 1x1)
function getToolBuildingSize(tool: Tool): { width: number; height: number } {
  const info = TOOL_INFO[tool];
  return info?.size ?? { width: 1, height: 1 };
}
import { drawStraightTrack, drawCurvedTrack, drawSlopeTrack, drawLoopTrack, drawChainLift } from '@/components/coaster/tracks';
import { drawGuest } from '@/components/coaster/guests';
import { useCoasterLightingSystem } from '@/components/coaster/lightingSystem';
import { useCoasterCloudSystem, Cloud } from '@/components/coaster/cloudSystem';
import { drawBeachOnWater } from '@/components/game/drawing';

// Track tools that support drag-to-draw
const TRACK_DRAG_TOOLS: Tool[] = [
  'coaster_build',
  'coaster_track',
  'coaster_slope_up',
  'coaster_slope_down',
  'path',
  'queue',
  'bulldoze',
];

// Scenery tools that support drag-to-draw (flowers, bushes, trees)
const SCENERY_DRAG_TOOLS: Tool[] = [
  // Trees
  'tree_oak', 'tree_maple', 'tree_birch', 'tree_elm', 'tree_willow',
  'tree_pine', 'tree_spruce', 'tree_fir', 'tree_cedar', 'tree_redwood',
  'tree_palm', 'tree_banana', 'tree_bamboo', 'tree_coconut', 'tree_tropical',
  'tree_cherry', 'tree_magnolia', 'tree_dogwood', 'tree_jacaranda', 'tree_wisteria',
  // Bushes
  'bush_hedge', 'bush_flowering',
  // Topiaries
  'topiary_ball', 'topiary_spiral', 'topiary_animal',
  // Flowers
  'flowers_bed', 'flowers_planter', 'flowers_hanging', 'flowers_wild', 'ground_cover',
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

/**
 * Check if a coaster's station tile has an adjacent queue line
 * Returns true if guests can board (has adjacent queue), false otherwise
 */
function hasAdjacentQueue(
  grid: Tile[][],
  stationX: number,
  stationY: number,
  gridSize: number
): boolean {
  const adjacentOffsets = [
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
  ];
  
  for (const { dx, dy } of adjacentOffsets) {
    const adjX = stationX + dx;
    const adjY = stationY + dy;
    if (adjX >= 0 && adjY >= 0 && adjX < gridSize && adjY < gridSize) {
      const adjTile = grid[adjY]?.[adjX];
      if (adjTile?.queue) {
        return true;
      }
    }
  }
  
  return false;
}

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

// Entrance gate colors
const ENTRANCE_COLORS = {
  archStone: '#78716c',       // Stone gray for arch
  archHighlight: '#a8a29e',   // Lighter stone highlight
  archShadow: '#57534e',      // Darker shadow
  postBase: '#44403c',        // Dark base
  gate: '#b91c1c',            // Red gate color (classic theme park)
  gateHighlight: '#dc2626',   // Lighter red
  sign: '#fef3c7',            // Cream/ivory sign background
  signText: '#1c1917',        // Dark text
  flagPole: '#d6d3d1',        // Light gray pole
  flagRed: '#dc2626',         // Red flag
  flagYellow: '#fbbf24',      // Yellow flag accent
};

/**
 * Check if a tile is at the edge of the map
 * Returns which edge(s) the tile is at
 */
function getTileEdgeInfo(gridX: number, gridY: number, gridSize: number): {
  isEdge: boolean;
  atNorth: boolean;  // x === 0 (top-left edge in isometric)
  atEast: boolean;   // y === 0 (top-right edge in isometric)
  atSouth: boolean;  // x === gridSize-1 (bottom-right edge in isometric)
  atWest: boolean;   // y === gridSize-1 (bottom-left edge in isometric)
} {
  const atNorth = gridX === 0;
  const atEast = gridY === 0;
  const atSouth = gridX === gridSize - 1;
  const atWest = gridY === gridSize - 1;
  return {
    isEdge: atNorth || atEast || atSouth || atWest,
    atNorth,
    atEast,
    atSouth,
    atWest,
  };
}

/**
 * Draw an entrance gate at the edge of the map
 * This creates a decorative archway/gate structure that marks the park entrance
 * The gate is oriented based on which edge of the map it's at, facing inward
 */
function drawEntranceGate(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  edgeInfo: ReturnType<typeof getTileEdgeInfo>,
  gridX: number,
  gridY: number
) {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  
  // Determine gate orientation based on which edge we're at
  // In isometric view:
  // - North edge (x=0): gate at top-left, path goes toward bottom-right
  // - East edge (y=0): gate at top-right, path goes toward bottom-left
  // - South edge (x=max): gate at bottom-right, path goes toward top-left
  // - West edge (y=max): gate at bottom-left, path goes toward top-right
  
  // For corner tiles (at 2 edges), only draw one gate to avoid clutter
  // Priority: North > East > South > West
  
  ctx.save();
  
  // Gate dimensions (scaled for isometric view)
  const postHeight = 32;
  const postWidth = 3;
  const archThickness = 4;
  
  // Pick the primary edge for gate placement (only one gate per tile)
  let primaryEdge: 'north' | 'east' | 'south' | 'west' | null = null;
  if (edgeInfo.atNorth) {
    primaryEdge = 'north';
  } else if (edgeInfo.atEast) {
    primaryEdge = 'east';
  } else if (edgeInfo.atSouth) {
    primaryEdge = 'south';
  } else if (edgeInfo.atWest) {
    primaryEdge = 'west';
  }
  
  if (!primaryEdge) {
    ctx.restore();
    return;
  }
  
  // Draw gate closer to tile center (30% from edge toward center)
  // This makes the gate more prominent and guests visually pass through it
  const edgeToCenterRatio = 0.35; // 0 = at edge, 1 = at center
  const tileCenterX = x + w * 0.5;
  const tileCenterY = y + h * 0.5;
  
  let edgeMidX: number, edgeMidY: number;
  
  switch (primaryEdge) {
    case 'north':
      // North edge midpoint, moved toward center
      edgeMidX = x + w * 0.25;
      edgeMidY = y + h * 0.25;
      break;
    case 'east':
      // East edge midpoint, moved toward center
      edgeMidX = x + w * 0.75;
      edgeMidY = y + h * 0.25;
      break;
    case 'south':
      // South edge midpoint, moved toward center
      edgeMidX = x + w * 0.75;
      edgeMidY = y + h * 0.75;
      break;
    case 'west':
      // West edge midpoint, moved toward center
      edgeMidX = x + w * 0.25;
      edgeMidY = y + h * 0.75;
      break;
  }
  
  // Interpolate between edge and center
  const edgeX = edgeMidX + (tileCenterX - edgeMidX) * edgeToCenterRatio;
  const edgeY = edgeMidY + (tileCenterY - edgeMidY) * edgeToCenterRatio;
  
  drawEntranceGateStructure(ctx, edgeX, edgeY, primaryEdge, postHeight, postWidth, archThickness);
  
  ctx.restore();
}

/**
 * Draw the actual gate structure at a given position and orientation
 */
function drawEntranceGateStructure(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  edge: 'north' | 'east' | 'south' | 'west',
  postHeight: number,
  postWidth: number,
  archThickness: number
) {
  // Gate width (distance between posts)
  const gateSpan = 18;
  
  // In isometric view, tile edges run diagonally:
  // - A tile's "north" edge (toward x-1) runs from top point to left point: direction (-1, +0.6) normalized
  // - A tile's "east" edge (toward y-1) runs from top point to right point: direction (+1, +0.6) normalized
  // - A tile's "south" edge (toward x+1) runs from right point to bottom point: direction (-1, +0.6) 
  // - A tile's "west" edge (toward y+1) runs from left point to bottom point: direction (+1, +0.6)
  //
  // The gate should span ALONG the tile edge (perpendicular to path direction)
  // So posts are placed along the edge direction
  
  let leftPostX: number, leftPostY: number;
  let rightPostX: number, rightPostY: number;
  
  const postOffset = gateSpan / 2;
  
  // Direction vectors along each tile edge (in screen coordinates)
  // North/South edges run along the "Y grid axis" which is (-1, +0.6) in screen
  // East/West edges run along the "X grid axis" which is (+1, +0.6) in screen
  
  switch (edge) {
    case 'north':
      // North edge: tile edge runs from top-point toward left-point
      // Direction along edge: roughly (-0.85, +0.5) - toward bottom-left
      // Posts placed along this direction from the edge center
      leftPostX = centerX + postOffset * 0.85;
      leftPostY = centerY - postOffset * 0.5;
      rightPostX = centerX - postOffset * 0.85;
      rightPostY = centerY + postOffset * 0.5;
      break;
    case 'east':
      // East edge: tile edge runs from top-point toward right-point
      // Direction along edge: roughly (+0.85, +0.5) - toward bottom-right
      leftPostX = centerX - postOffset * 0.85;
      leftPostY = centerY - postOffset * 0.5;
      rightPostX = centerX + postOffset * 0.85;
      rightPostY = centerY + postOffset * 0.5;
      break;
    case 'south':
      // South edge: tile edge runs from right-point toward bottom-point
      // Same direction as north edge (parallel)
      leftPostX = centerX + postOffset * 0.85;
      leftPostY = centerY - postOffset * 0.5;
      rightPostX = centerX - postOffset * 0.85;
      rightPostY = centerY + postOffset * 0.5;
      break;
    case 'west':
      // West edge: tile edge runs from left-point toward bottom-point
      // Same direction as east edge (parallel)
      leftPostX = centerX - postOffset * 0.85;
      leftPostY = centerY - postOffset * 0.5;
      rightPostX = centerX + postOffset * 0.85;
      rightPostY = centerY + postOffset * 0.5;
      break;
  }
  
  // Draw shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
  ctx.beginPath();
  ctx.ellipse(centerX, centerY + 4, gateSpan * 0.4, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Draw left post (pillar)
  drawGatePost(ctx, leftPostX, leftPostY, postHeight, postWidth);
  
  // Draw right post (pillar)
  drawGatePost(ctx, rightPostX, rightPostY, postHeight, postWidth);
  
  // Draw arch connecting posts
  const archTopY = Math.min(leftPostY, rightPostY) - postHeight;
  const archCenterX = (leftPostX + rightPostX) / 2;
  const archCenterY = (leftPostY + rightPostY) / 2;
  
  // Arch body
  ctx.fillStyle = ENTRANCE_COLORS.archStone;
  ctx.beginPath();
  ctx.moveTo(leftPostX - postWidth / 2, leftPostY - postHeight + 2);
  ctx.lineTo(leftPostX - postWidth / 2, leftPostY - postHeight - 2);
  ctx.quadraticCurveTo(archCenterX, archCenterY - postHeight - 10, rightPostX + postWidth / 2, rightPostY - postHeight - 2);
  ctx.lineTo(rightPostX + postWidth / 2, rightPostY - postHeight + 2);
  ctx.quadraticCurveTo(archCenterX, archCenterY - postHeight - 6, leftPostX - postWidth / 2, leftPostY - postHeight + 2);
  ctx.closePath();
  ctx.fill();
  
  // Arch highlight
  ctx.strokeStyle = ENTRANCE_COLORS.archHighlight;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(leftPostX - postWidth / 2, leftPostY - postHeight - 2);
  ctx.quadraticCurveTo(archCenterX, archCenterY - postHeight - 10, rightPostX + postWidth / 2, rightPostY - postHeight - 2);
  ctx.stroke();
  
  // Sign on arch
  const signWidth = gateSpan * 0.6;
  const signHeight = 5;
  ctx.fillStyle = ENTRANCE_COLORS.sign;
  ctx.beginPath();
  ctx.roundRect(archCenterX - signWidth / 2, archCenterY - postHeight - 7, signWidth, signHeight, 1.5);
  ctx.fill();
  
  // Sign border
  ctx.strokeStyle = ENTRANCE_COLORS.gate;
  ctx.lineWidth = 0.6;
  ctx.stroke();
  
  // Decorative banner/flag at the top center
  const bannerHeight = 8;
  ctx.fillStyle = ENTRANCE_COLORS.flagRed;
  ctx.beginPath();
  ctx.moveTo(archCenterX, archCenterY - postHeight - 8);
  ctx.lineTo(archCenterX + 5, archCenterY - postHeight - 4);
  ctx.lineTo(archCenterX, archCenterY - postHeight);
  ctx.closePath();
  ctx.fill();
  
  // Small finial on top
  ctx.fillStyle = ENTRANCE_COLORS.archHighlight;
  ctx.beginPath();
  ctx.arc(archCenterX, archCenterY - postHeight - 9, 2, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Draw a single gate post/pillar
 */
function drawGatePost(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  height: number,
  width: number
) {
  // Post shadow side
  ctx.fillStyle = ENTRANCE_COLORS.archShadow;
  ctx.fillRect(x - width / 2, y - height, width, height);
  
  // Post main face
  ctx.fillStyle = ENTRANCE_COLORS.archStone;
  ctx.fillRect(x - width / 2 + 0.5, y - height, width - 1, height);
  
  // Post highlight edge
  ctx.fillStyle = ENTRANCE_COLORS.archHighlight;
  ctx.fillRect(x - width / 2, y - height, 1, height);
  
  // Post cap (decorative top)
  ctx.fillStyle = ENTRANCE_COLORS.archHighlight;
  ctx.fillRect(x - width / 2 - 1, y - height - 2, width + 2, 3);
  
  // Post base (wider at bottom)
  ctx.fillStyle = ENTRANCE_COLORS.postBase;
  ctx.fillRect(x - width / 2 - 1, y - 2, width + 2, 3);
  
  // Ball finial on top
  ctx.fillStyle = ENTRANCE_COLORS.archStone;
  ctx.beginPath();
  ctx.arc(x, y - height - 3, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ENTRANCE_COLORS.archHighlight;
  ctx.beginPath();
  ctx.arc(x - 0.5, y - height - 3.5, 0.8, 0, Math.PI * 2);
  ctx.fill();
}

// Check if a building type is a shop or food stand (guests can visit)
function isVisitableBuilding(type: string | undefined): boolean {
  if (!type) return false;
  return (
    type.startsWith('shop_') ||
    type.startsWith('food_') ||
    type.startsWith('drink_') ||
    type.startsWith('snack_') ||
    type.startsWith('cart_') ||
    type.startsWith('game_') ||
    type === 'arcade_building' ||
    type === 'vr_experience' ||
    type === 'photo_booth' ||
    type === 'caricature' ||
    type === 'face_paint' ||
    type === 'restroom' ||
    type === 'first_aid' ||
    type === 'lockers' ||
    type === 'stroller_rental' ||
    type === 'atm'
  );
}

// Grey base tile colors (matching iso city style)
const GREY_TILE_COLORS = {
  top: '#6b7280',
  left: '#4b5563',
  right: '#9ca3af',
  stroke: '#374151',
};

// Check if a building type needs grey base tiles (rides, shops, food stands)
function needsGreyBase(type: string | undefined): boolean {
  if (!type) return false;
  return (
    // Rides
    type.startsWith('ride_') ||
    type.startsWith('show_') ||
    // Shops
    type.startsWith('shop_') ||
    type.startsWith('game_') ||
    type === 'arcade_building' ||
    type === 'vr_experience' ||
    type === 'restroom' ||
    type === 'first_aid' ||
    type === 'lockers' ||
    // Food stands
    type.startsWith('food_') ||
    type.startsWith('drink_') ||
    type.startsWith('snack_') ||
    type.startsWith('cart_') ||
    // Large fountains
    type.startsWith('fountain_large_') ||
    type === 'dancing_fountain' ||
    type === 'pond_large' ||
    // Infrastructure
    type.startsWith('infra_')
  );
}

// Draw grey base tiles for multi-tile buildings
function drawGreyBaseTiles(
  ctx: CanvasRenderingContext2D,
  gridX: number,
  gridY: number,
  width: number,
  height: number,
  zoom: number,
  grid: Tile[][],
  gridSize: number
) {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  
  // Draw grey diamond for each tile in the footprint
  for (let dx = 0; dx < width; dx++) {
    for (let dy = 0; dy < height; dy++) {
      const tileX = gridX + dx;
      const tileY = gridY + dy;
      
      // Skip if out of bounds
      if (tileX < 0 || tileY < 0 || tileX >= gridSize || tileY >= gridSize) continue;
      
      // Skip tiles that have coaster tracks - don't draw grey base over tracks
      const tile = grid[tileY]?.[tileX];
      if (tile?.trackPiece) continue;
      
      // Convert to screen coordinates
      const screenX = (tileX - tileY) * (w / 2);
      const screenY = (tileX + tileY) * (h / 2);
      
      // Draw the grey isometric diamond
      ctx.fillStyle = GREY_TILE_COLORS.top;
      ctx.beginPath();
      ctx.moveTo(screenX + w / 2, screenY);
      ctx.lineTo(screenX + w, screenY + h / 2);
      ctx.lineTo(screenX + w / 2, screenY + h);
      ctx.lineTo(screenX, screenY + h / 2);
      ctx.closePath();
      ctx.fill();
      
      // Draw stroke when zoomed in enough
      if (zoom >= 0.6) {
        ctx.strokeStyle = GREY_TILE_COLORS.stroke;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }
  }
}

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
  
  // Check adjacent tiles for visitable buildings (shops, food stands, etc.)
  const hasVisitableBuilding = (gx: number, gy: number) => {
    if (gx < 0 || gy < 0 || gx >= gridSize || gy >= gridSize) return false;
    const tile = grid[gy]?.[gx];
    return tile?.building && isVisitableBuilding(tile.building.type);
  };

  const north = hasPath(gridX - 1, gridY);
  const east = hasPath(gridX, gridY - 1);
  const south = hasPath(gridX + 1, gridY);
  const west = hasPath(gridX, gridY + 1);
  
  // Check for adjacent visitable buildings (to draw sidewalk connections)
  const northBuilding = hasVisitableBuilding(gridX - 1, gridY);
  const eastBuilding = hasVisitableBuilding(gridX, gridY - 1);
  const southBuilding = hasVisitableBuilding(gridX + 1, gridY);
  const westBuilding = hasVisitableBuilding(gridX, gridY + 1);

  // Draw grass base first
  drawGrassTile(ctx, x, y, 1);

  // Path width ratio (wider than queue lines for visual hierarchy)
  const pathWidthRatio = 0.18;
  const pathW = w * pathWidthRatio;
  const halfWidth = pathW * 0.5;

  // Edge stop distance - extend past edge (>1.0) to ensure overlap and flush alignment at tile boundaries
  const edgeStop = 1.15;

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

  // Get perpendicular vector (screen-space)
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

  // Draw sidewalk connections to adjacent visitable buildings (shops, food stands, etc.)
  // Use the same width and style as regular paths for consistency
  const drawBuildingConnector = (
    dirDx: number,
    dirDy: number,
    edgeX: number,
    edgeY: number
  ) => {
    const perp = getPerp(dirDx, dirDy);
    const stopX = cx + (edgeX - cx) * edgeStop;
    const stopY = cy + (edgeY - cy) * edgeStop;
    
    // Draw connector surface (same style as main path)
    ctx.fillStyle = PATH_COLORS.surface;
    ctx.beginPath();
    ctx.moveTo(cx + perp.nx * halfWidth, cy + perp.ny * halfWidth);
    ctx.lineTo(stopX + perp.nx * halfWidth, stopY + perp.ny * halfWidth);
    ctx.lineTo(stopX - perp.nx * halfWidth, stopY - perp.ny * halfWidth);
    ctx.lineTo(cx - perp.nx * halfWidth, cy - perp.ny * halfWidth);
    ctx.closePath();
    ctx.fill();
  };

  // Draw connectors to adjacent buildings (only if there's no path already in that direction)
  if (northBuilding && !north) drawBuildingConnector(northDx, northDy, northEdgeX, northEdgeY);
  if (eastBuilding && !east) drawBuildingConnector(eastDx, eastDy, eastEdgeX, eastEdgeY);
  if (southBuilding && !south) drawBuildingConnector(southDx, southDy, southEdgeX, southEdgeY);
  if (westBuilding && !west) drawBuildingConnector(westDx, westDy, westEdgeX, westEdgeY);

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

// Guest colors for queue rendering
const QUEUE_GUEST_COLORS = {
  skin: ['#ffd5b4', '#f5c9a6', '#e5b898', '#d4a574', '#c49462', '#a67b5b', '#8b6b4a'],
  shirt: ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4'],
  pants: ['#1e293b', '#475569', '#64748b', '#0f172a'],
};

// Seeded random for consistent queue guest appearance
function seededRandomQueue(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

function drawQueueTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  gridX: number,
  gridY: number,
  grid: Tile[][],
  gridSize: number,
  queueGuestCount: number = 0,
  tick: number = 0
) {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = x + w / 2;
  const cy = y + h / 2;

  // Check adjacent queue tiles for connections (same pattern as drawPathTile)
  const hasQueue = (gx: number, gy: number) => {
    if (gx < 0 || gy < 0 || gx >= gridSize || gy >= gridSize) return false;
    return grid[gy][gx].queue;
  };
  
  // Check adjacent paths for connections (queue should connect to paths)
  const hasPath = (gx: number, gy: number) => {
    if (gx < 0 || gy < 0 || gx >= gridSize || gy >= gridSize) return false;
    return grid[gy][gx].path;
  };

  // Queue connects to other queues OR to paths
  const north = hasQueue(gridX - 1, gridY) || hasPath(gridX - 1, gridY);
  const east = hasQueue(gridX, gridY - 1) || hasPath(gridX, gridY - 1);
  const south = hasQueue(gridX + 1, gridY) || hasPath(gridX + 1, gridY);
  const west = hasQueue(gridX, gridY + 1) || hasPath(gridX, gridY + 1);

  // Draw grass base first
  drawGrassTile(ctx, x, y, 1);

  // Queue width ratio (narrower than paths for visual hierarchy)
  const queueWidthRatio = 0.14;
  const queueW = w * queueWidthRatio;
  const halfWidth = queueW * 0.5;
  const barrierOffset = halfWidth * 0.85; // Distance from center to barrier

  // Edge stop distance - extend past edge (>1.0) to ensure overlap and flush alignment at tile boundaries
  const edgeStop = 1.15;

  // Edge midpoints (matching path system exactly)
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

  // Get perpendicular vector (screen-space)
  const getPerp = (dx: number, dy: number) => ({ nx: -dy, ny: dx });

  // Draw queue surface to connected neighbors
  ctx.fillStyle = QUEUE_COLORS.surface;

  const connectionCount = (north ? 1 : 0) + (east ? 1 : 0) + (south ? 1 : 0) + (west ? 1 : 0);

  // Draw queue segments to connected neighbors
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

  // If isolated (no connections), draw a small circle in center
  if (connectionCount === 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, halfWidth, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw surface edge
  ctx.strokeStyle = QUEUE_COLORS.surfaceEdge;
  ctx.lineWidth = 0.5;

  // Barrier rendering constants
  const postH = 5;
  const postR = 1.0;

  // Helper to draw a barrier rope with shadow
  const drawBarrier = (x1: number, y1: number, x2: number, y2: number) => {
    // Shadow
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1 + 0.5, y1 + 1);
    ctx.lineTo(x2 + 0.5, y2 + 1);
    ctx.stroke();
    
    // Rope
    ctx.strokeStyle = QUEUE_COLORS.beltColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };

  // Helper to draw a post
  const drawPost = (px: number, py: number) => {
    // Post shadow
    ctx.strokeStyle = QUEUE_COLORS.postShadow;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px + 0.5, py + 1);
    ctx.lineTo(px + 0.5, py - postH + 1);
    ctx.stroke();
    
    // Post pole
    ctx.strokeStyle = QUEUE_COLORS.postPole;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px, py - postH);
    ctx.stroke();
    
    // Post top
    ctx.fillStyle = QUEUE_COLORS.postTop;
    ctx.beginPath();
    ctx.arc(px, py - postH, postR, 0, Math.PI * 2);
    ctx.fill();
  };

  // Draw barriers along each connected edge (on both sides of the path)
  const drawEdgeBarriers = (
    dirDx: number,
    dirDy: number,
    edgeX: number,
    edgeY: number
  ) => {
    const perp = getPerp(dirDx, dirDy);
    const stopX = cx + (edgeX - cx) * edgeStop;
    const stopY = cy + (edgeY - cy) * edgeStop;

    // Left barrier
    const leftStartX = cx + perp.nx * barrierOffset;
    const leftStartY = cy + perp.ny * barrierOffset;
    const leftEndX = stopX + perp.nx * barrierOffset;
    const leftEndY = stopY + perp.ny * barrierOffset;
    drawBarrier(leftStartX, leftStartY, leftEndX, leftEndY);

    // Right barrier
    const rightStartX = cx - perp.nx * barrierOffset;
    const rightStartY = cy - perp.ny * barrierOffset;
    const rightEndX = stopX - perp.nx * barrierOffset;
    const rightEndY = stopY - perp.ny * barrierOffset;
    drawBarrier(rightStartX, rightStartY, rightEndX, rightEndY);
  };

  // Draw barriers for each connection
  if (north) drawEdgeBarriers(northDx, northDy, northEdgeX, northEdgeY);
  if (east) drawEdgeBarriers(eastDx, eastDy, eastEdgeX, eastEdgeY);
  if (south) drawEdgeBarriers(southDx, southDy, southEdgeX, southEdgeY);
  if (west) drawEdgeBarriers(westDx, westDy, westEdgeX, westEdgeY);

  // Draw corner posts at the center and at junctions
  // Collect all unique post positions
  const postPositions: { x: number; y: number }[] = [];

  // Add center posts where barriers meet
  if (connectionCount >= 1) {
    // For each connected direction, add posts at center perpendicular positions
    const addCenterPosts = (dirDx: number, dirDy: number) => {
      const perp = getPerp(dirDx, dirDy);
      postPositions.push({ x: cx + perp.nx * barrierOffset, y: cy + perp.ny * barrierOffset });
      postPositions.push({ x: cx - perp.nx * barrierOffset, y: cy - perp.ny * barrierOffset });
    };

    if (north) addCenterPosts(northDx, northDy);
    if (east) addCenterPosts(eastDx, eastDy);
    if (south) addCenterPosts(southDx, southDy);
    if (west) addCenterPosts(westDx, westDy);
  }

  // Draw cross-barriers at dead ends (cap the queue path)
  if (connectionCount === 1) {
    // Single connection - draw a cap barrier at center on the opposite side
    let capDx = 0, capDy = 0;
    if (north) { capDx = southDx; capDy = southDy; }
    else if (east) { capDx = westDx; capDy = westDy; }
    else if (south) { capDx = northDx; capDy = northDy; }
    else if (west) { capDx = eastDx; capDy = eastDy; }
    
    const perp = getPerp(capDx, capDy);
    drawBarrier(
      cx + perp.nx * barrierOffset,
      cy + perp.ny * barrierOffset,
      cx - perp.nx * barrierOffset,
      cy - perp.ny * barrierOffset
    );
  }

  // Draw all posts (deduplicated by rounding position)
  const drawnPosts = new Set<string>();
  for (const pos of postPositions) {
    const key = `${Math.round(pos.x * 2)},${Math.round(pos.y * 2)}`;
    if (!drawnPosts.has(key)) {
      drawnPosts.add(key);
      drawPost(pos.x, pos.y);
    }
  }

  // Draw guests along the queue path
  const maxGuestsPerTile = 12;
  const guestsToShow = Math.min(queueGuestCount, maxGuestsPerTile);
  
  if (guestsToShow > 0) {
    const rand = seededRandomQueue(gridX * 1000 + gridY * 7919);
    
    // Build path through queue based on connections
    const pathPoints: { x: number; y: number }[] = [];
    
    // For straight paths (2 opposite connections), draw guests along the line
    // For corners/junctions, guests cluster in center
    if (connectionCount >= 2) {
      // Add entry and exit points based on connections
      if (north) {
        const stopX = cx + (northEdgeX - cx) * 0.7;
        const stopY = cy + (northEdgeY - cy) * 0.7;
        pathPoints.push({ x: stopX, y: stopY });
      }
      pathPoints.push({ x: cx, y: cy });
      if (south) {
        const stopX = cx + (southEdgeX - cx) * 0.7;
        const stopY = cy + (southEdgeY - cy) * 0.7;
        pathPoints.push({ x: stopX, y: stopY });
      }
      if (east) {
        const stopX = cx + (eastEdgeX - cx) * 0.7;
        const stopY = cy + (eastEdgeY - cy) * 0.7;
        pathPoints.push({ x: stopX, y: stopY });
      }
      if (west) {
        const stopX = cx + (westEdgeX - cx) * 0.7;
        const stopY = cy + (westEdgeY - cy) * 0.7;
        pathPoints.push({ x: stopX, y: stopY });
      }
    } else {
      // Single or no connection - cluster around center
      pathPoints.push({ x: cx, y: cy });
    }
    
    const guestPositions: { x: number; y: number; depth: number }[] = [];
    
    for (let i = 0; i < guestsToShow; i++) {
      // Distribute along path or cluster around center
      let gx: number, gy: number;
      
      if (pathPoints.length >= 2) {
        // Distribute evenly along path
        const t = (i + 0.5) / guestsToShow;
        const idx = Math.floor(t * (pathPoints.length - 1));
        const localT = (t * (pathPoints.length - 1)) - idx;
        const p1 = pathPoints[idx];
        const p2 = pathPoints[Math.min(idx + 1, pathPoints.length - 1)];
        gx = p1.x + (p2.x - p1.x) * localT + (rand() - 0.5) * 2;
        gy = p1.y + (p2.y - p1.y) * localT + (rand() - 0.5) * 1;
      } else {
        // Cluster around center
        const angle = rand() * Math.PI * 2;
        const dist = rand() * halfWidth * 0.6;
        gx = cx + Math.cos(angle) * dist;
        gy = cy + Math.sin(angle) * dist * 0.5;
      }
      
      guestPositions.push({ x: gx, y: gy, depth: gy });
    }
    
    // Sort by depth and draw
    guestPositions.sort((a, b) => a.depth - b.depth);
    
    for (let i = 0; i < guestPositions.length; i++) {
      const pos = guestPositions[i];
      const guestRand = seededRandomQueue(gridX * 1000 + gridY * 7919 + i * 1337);
      
      // Pick colors
      const skinColor = QUEUE_GUEST_COLORS.skin[Math.floor(guestRand() * QUEUE_GUEST_COLORS.skin.length)];
      const shirtColor = QUEUE_GUEST_COLORS.shirt[Math.floor(guestRand() * QUEUE_GUEST_COLORS.shirt.length)];
      const pantsColor = QUEUE_GUEST_COLORS.pants[Math.floor(guestRand() * QUEUE_GUEST_COLORS.pants.length)];
      
      // Idle animation (slight sway)
      const idleCycle = Math.sin((tick * 0.08 + i * 0.5) * 2);
      const swayX = idleCycle * 0.3;
      const gx = pos.x + swayX;
      const gy = pos.y;
      
      // Draw simple guest sprite (scaled down for queue)
      const scale = 0.8;
      
      // Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.beginPath();
      ctx.ellipse(gx, gy + 0.5 * scale, 1.2 * scale, 0.6 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Legs/pants
      ctx.fillStyle = pantsColor;
      ctx.fillRect(gx - 0.6 * scale, gy - 1.5 * scale, 0.4 * scale, 1.2 * scale);
      ctx.fillRect(gx + 0.2 * scale, gy - 1.5 * scale, 0.4 * scale, 1.2 * scale);
      
      // Torso
      ctx.fillStyle = shirtColor;
      ctx.fillRect(gx - 0.8 * scale, gy - 2.8 * scale, 1.6 * scale, 1.4 * scale);
      
      // Head
      ctx.fillStyle = skinColor;
      ctx.beginPath();
      ctx.arc(gx, gy - 3.8 * scale, 0.8 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
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
  
  // Get building size from TOOL_INFO for multi-tile scaling
  const toolInfo = TOOL_INFO[buildingType as Tool];
  const buildingSize = toolInfo?.size ?? { width: 1, height: 1 };
  // For multi-tile buildings, scale up by the larger dimension
  // This makes 2x2 buildings roughly 2x as large, 3x3 roughly 3x, etc.
  const sizeMultiplier = Math.max(buildingSize.width, buildingSize.height);
  
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
  
  // Standard single sprite rendering with multi-tile size scaling
  const scale = baseScale * sizeMultiplier;
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

/**
 * Draw an animated warning indicator for incomplete track ends
 * Shows a small pulsing warning dot
 */
function drawIncompleteTrackWarning(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  tick: number,
  _coasterName: string
) {
  // Pulsing animation based on tick
  const pulse = Math.sin(tick * 0.15) * 0.5 + 0.5; // 0 to 1
  const alpha = 0.8 + pulse * 0.2; // Alpha from 0.8 to 1.0
  
  // Position at center of the tile
  const iconX = screenX + TILE_WIDTH / 2;
  const iconY = screenY + TILE_HEIGHT / 2;
  
  ctx.save();
  ctx.globalAlpha = alpha;
  
  // Small outer glow
  const glowRadius = 8 + pulse * 2;
  const gradient = ctx.createRadialGradient(iconX, iconY, 2, iconX, iconY, glowRadius);
  gradient.addColorStop(0, 'rgba(255, 80, 50, 0.7)');
  gradient.addColorStop(0.6, 'rgba(255, 80, 50, 0.2)');
  gradient.addColorStop(1, 'rgba(255, 80, 50, 0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(iconX, iconY, glowRadius, 0, Math.PI * 2);
  ctx.fill();
  
  // Small warning dot
  ctx.fillStyle = '#f97316'; // Orange
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(iconX, iconY, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  
  // Tiny exclamation mark
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 7px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('!', iconX, iconY);
  
  ctx.restore();
}

function drawTrackSegment(
  ctx: CanvasRenderingContext2D,
  trackPiece: Tile['trackPiece'],
  x: number,
  y: number,
  tick: number,
  trackColor?: string,
  coasterCategory?: CoasterCategory
) {
  if (!trackPiece) return;
  
  const { type, direction, startHeight, endHeight, chainLift, strutStyle } = trackPiece;
  // Default to metal if strutStyle not defined (for backwards compatibility with old saves)
  const effectiveStrutStyle = strutStyle ?? 'metal';
  // Use provided track color or default
  const effectiveTrackColor = trackColor;
  
  if (type === 'straight_flat' || type === 'lift_hill_start' || type === 'lift_hill_middle' || type === 'lift_hill_end') {
    drawStraightTrack(ctx, x, y, direction, startHeight, effectiveTrackColor, effectiveStrutStyle, coasterCategory, tick);
  } else if (type === 'turn_left_flat' || type === 'turn_right_flat') {
    drawCurvedTrack(ctx, x, y, direction, type === 'turn_right_flat', startHeight, effectiveTrackColor, effectiveStrutStyle, coasterCategory, tick);
  } else if (type === 'slope_up_small' || type === 'slope_down_small') {
    drawSlopeTrack(ctx, x, y, direction, startHeight, endHeight, effectiveTrackColor, effectiveStrutStyle, coasterCategory, tick);
  } else if (type === 'loop_vertical') {
    // Draw loop - the function handles edge connections internally
    const loopHeight = Math.max(3, endHeight + 3);
    // Offset Y for track elevation
    const elevatedY = y - startHeight * HEIGHT_UNIT;
    // Pass startHeight as baseHeight so the support column reaches the ground
    drawLoopTrack(ctx, x, elevatedY, direction, loopHeight, effectiveTrackColor, effectiveStrutStyle, coasterCategory, tick, startHeight);
  } else {
    // Default fallback to straight for unimplemented pieces
    drawStraightTrack(ctx, x, y, direction, startHeight, effectiveTrackColor, effectiveStrutStyle, coasterCategory, tick);
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
): { x: number; y: number; pitch: number } {
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
      pitch: 0, // Flat turns have no pitch
    };
  }
  
  if (type === 'loop_vertical') {
    // Match the loop drawing logic EXACTLY - fixed size regardless of track height
    const loopRadius = 30;
    
    // Determine entry and exit edges based on direction (same as drawing)
    let entryEdge: { x: number; y: number };
    let exitEdge: { x: number; y: number };
    
    if (direction === 'south') {
      entryEdge = { x: startX + w * 0.25, y: startY + h * 0.25 };
      exitEdge = { x: startX + w * 0.75, y: startY + h * 0.75 };
    } else if (direction === 'north') {
      entryEdge = { x: startX + w * 0.75, y: startY + h * 0.75 };
      exitEdge = { x: startX + w * 0.25, y: startY + h * 0.25 };
    } else if (direction === 'east') {
      entryEdge = { x: startX + w * 0.25, y: startY + h * 0.75 };
      exitEdge = { x: startX + w * 0.75, y: startY + h * 0.25 };
    } else { // west
      entryEdge = { x: startX + w * 0.75, y: startY + h * 0.25 };
      exitEdge = { x: startX + w * 0.25, y: startY + h * 0.75 };
    }
    
    // Track direction for bulge
    const trackDx = exitEdge.x - entryEdge.x;
    const trackDy = exitEdge.y - entryEdge.y;
    const trackLen = Math.hypot(trackDx, trackDy);
    
    // Forward progress: linear from entry to exit
    const forwardX = entryEdge.x + t * (exitEdge.x - entryEdge.x);
    const forwardY = entryEdge.y + t * (exitEdge.y - entryEdge.y);
    
    // Loop angle: full rotation (0 to 2π)
    const angle = t * Math.PI * 2;
    
    // Height: (1 - cos(angle)) gives 0 at entry/exit, 2*radius at top
    const loopHeightOffset = (1 - Math.cos(angle)) * loopRadius;
    
    // Horizontal bulge to make it circular - must match drawing
    const bulgeFactor = 0.9;
    const bulgeOffset = Math.sin(angle) * loopRadius * bulgeFactor;
    const bulgeX = (trackDx / trackLen) * bulgeOffset;
    const bulgeY = (trackDy / trackLen) * bulgeOffset;
    
    // Apply track elevation
    const elevation = trackPiece.startHeight * HEIGHT_UNIT;
    
    // Calculate pitch for loops - full rotation around the loop
    const loopPitch = angle;
    
    return {
      x: forwardX + bulgeX,
      y: forwardY + bulgeY - loopHeightOffset - elevation,
      pitch: loopPitch,
    };
  }
  
  // Straight or slope segments - use edge midpoints
  // Direction determines which way the train travels through the tile
  // North/South tracks go diagonally from top-left to bottom-right
  // East/West tracks go diagonally from top-right to bottom-left
  
  // Calculate pitch angle based on height change
  const heightDiff = trackPiece.endHeight - trackPiece.startHeight;
  const trackLength = Math.hypot(TILE_WIDTH / 2, TILE_HEIGHT / 2);
  const heightChange = heightDiff * HEIGHT_UNIT;
  const slopePitch = Math.atan2(-heightChange, trackLength);
  
  if (direction === 'south') {
    // South: enter from north edge (top-left), exit to south edge (bottom-right)
    const fromX = startX + w * 0.25;
    const fromY = startY + h * 0.25 - trackPiece.startHeight * HEIGHT_UNIT;
    const toX = startX + w * 0.75;
    const toY = startY + h * 0.75 - trackPiece.endHeight * HEIGHT_UNIT;
    return { x: fromX + (toX - fromX) * t, y: fromY + (toY - fromY) * t, pitch: slopePitch };
  } else if (direction === 'north') {
    // North: enter from south edge (bottom-right), exit to north edge (top-left)
    const fromX = startX + w * 0.75;
    const fromY = startY + h * 0.75 - trackPiece.startHeight * HEIGHT_UNIT;
    const toX = startX + w * 0.25;
    const toY = startY + h * 0.25 - trackPiece.endHeight * HEIGHT_UNIT;
    return { x: fromX + (toX - fromX) * t, y: fromY + (toY - fromY) * t, pitch: slopePitch };
  } else if (direction === 'west') {
    // West: enter from east edge (top-right), exit to west edge (bottom-left)
    const fromX = startX + w * 0.75;
    const fromY = startY + h * 0.25 - trackPiece.startHeight * HEIGHT_UNIT;
    const toX = startX + w * 0.25;
    const toY = startY + h * 0.75 - trackPiece.endHeight * HEIGHT_UNIT;
    return { x: fromX + (toX - fromX) * t, y: fromY + (toY - fromY) * t, pitch: slopePitch };
  } else {
    // East: enter from west edge (bottom-left), exit to east edge (top-right)
    const fromX = startX + w * 0.25;
    const fromY = startY + h * 0.75 - trackPiece.startHeight * HEIGHT_UNIT;
    const toX = startX + w * 0.75;
    const toY = startY + h * 0.25 - trackPiece.endHeight * HEIGHT_UNIT;
    return { x: fromX + (toX - fromX) * t, y: fromY + (toY - fromY) * t, pitch: slopePitch };
  }
}

// Direction angles for isometric view (matching train system)
const DIRECTION_ANGLES: Record<string, number> = {
  north: Math.atan2(-TILE_HEIGHT / 2, -TILE_WIDTH / 2),
  south: Math.atan2(TILE_HEIGHT / 2, TILE_WIDTH / 2),
  east: Math.atan2(-TILE_HEIGHT / 2, TILE_WIDTH / 2),
  west: Math.atan2(TILE_HEIGHT / 2, -TILE_WIDTH / 2),
};

function directionFromDelta(dx: number, dy: number): string | null {
  if (dx === 1 && dy === 0) return 'south';
  if (dx === -1 && dy === 0) return 'north';
  if (dx === 0 && dy === 1) return 'west';
  if (dx === 0 && dy === -1) return 'east';
  return null;
}

/**
 * Get the actual travel direction for a car at parameter t along a track piece.
 * For curves, calculates the tangent direction of the bezier curve.
 * For straights, uses the tile delta direction.
 */
function getCarTravelDirection(
  trackPiece: NonNullable<Tile['trackPiece']>,
  trackTiles: { x: number; y: number }[],
  trackIndex: number,
  t: number
): string {
  const trackLen = trackTiles.length;
  const { type, direction } = trackPiece;
  
  // For curves, calculate travel direction based on curve geometry
  if (type === 'turn_left_flat' || type === 'turn_right_flat') {
    const turnRight = type === 'turn_right_flat';
    
    // The track's direction field indicates which edge the curve STARTS from
    // But the car should face the direction it's TRAVELING (opposite of where it came from)
    const opposite: Record<string, string> = {
      north: 'south', south: 'north', east: 'west', west: 'east'
    };
    
    // Travel direction when entering the curve (opposite of entry edge)
    const travelEntryDir = opposite[direction];
    
    // Exit direction depends on turn type
    // For right turn: north entry → east exit, east entry → south exit, etc.
    // For left turn: north entry → west exit, west entry → south exit, etc.
    let travelExitDir: string;
    if (turnRight) {
      const rightTurn: Record<string, string> = {
        north: 'east', east: 'south', south: 'west', west: 'north'
      };
      travelExitDir = rightTurn[direction];
    } else {
      const leftTurn: Record<string, string> = {
        north: 'west', west: 'south', south: 'east', east: 'north'
      };
      travelExitDir = leftTurn[direction];
    }
    
    // Interpolate between entry and exit travel directions based on position on curve
    if (t < 0.35) {
      return travelEntryDir;
    } else if (t > 0.65) {
      return travelExitDir;
    } else {
      return t < 0.5 ? travelEntryDir : travelExitDir;
    }
  }
  
  // For non-curves, use tile deltas
  if (trackLen < 2) return trackPiece.direction;

  const prevTile = trackTiles[(trackIndex - 1 + trackLen) % trackLen];
  const currTile = trackTiles[trackIndex];
  const nextTile = trackTiles[(trackIndex + 1) % trackLen];

  const entryDir = directionFromDelta(currTile.x - prevTile.x, currTile.y - prevTile.y);
  const exitDir = directionFromDelta(nextTile.x - currTile.x, nextTile.y - currTile.y);

  if (!entryDir || !exitDir) return trackPiece.direction;

  // Straight segments: use consistent direction
  if (entryDir === exitDir) return entryDir;

  // For slopes or other track types, interpolate between entry and exit
  if (t < 0.3) return entryDir;
  if (t > 0.7) return exitDir;
  return t < 0.5 ? entryDir : exitDir;
}

// Guest colors for rendering riders in coaster cars
const RIDER_COLORS = {
  skin: ['#ffd5b4', '#f5c9a6', '#e5b898', '#d4a574', '#c49462'],
  shirt: ['#ef4444', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#f97316'],
};

/**
 * Draw boarding guests at a station tile
 * Shows guests walking toward or away from the coaster car
 */
function drawBoardingGuests(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  isBoarding: boolean, // true = boarding, false = exiting
  guestCount: number,
  tick: number,
  loadingProgress: number // 0 to 1, how far along the loading cycle
) {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = x + w / 2;
  const cy = y + h / 2;
  
  // Platform area (to the side of the track)
  const platformX = cx - 18;
  const platformY = cy + 4;
  
  // Car position (center of tile, elevated)
  const carX = cx;
  const carY = cy - 4;
  
  const guestsToShow = Math.min(guestCount, 8);
  const scale = 0.7; // Match normal park guest sprite size
  
  for (let i = 0; i < guestsToShow; i++) {
    // Stagger guest animations
    const guestProgress = Math.max(0, Math.min(1, loadingProgress * 1.5 - i * 0.1));
    
    // Guest walks from platform to car position (or vice versa)
    // Spread guests out on platform
    const row = Math.floor(i / 4);
    const col = i % 4;
    const startX = platformX + col * 5;
    const startY = platformY + row * 6;
    
    // End positions near the car (alternating sides)
    const endX = carX + (col - 1.5) * 4;
    const endY = carY + row * 2;
    
    let guestX: number, guestY: number;
    if (isBoarding) {
      guestX = startX + (endX - startX) * guestProgress;
      guestY = startY + (endY - startY) * guestProgress;
    } else {
      guestX = endX + (startX - endX) * guestProgress;
      guestY = endY + (startY - endY) * guestProgress;
    }
    
    // Always draw guest during loading (visible during the whole animation)
    if (guestProgress < 0.98) {
      const colorSeed = (i * 17 + Math.floor(tick / 200)) % 100;
      const skinColor = RIDER_COLORS.skin[colorSeed % RIDER_COLORS.skin.length];
      const shirtColor = RIDER_COLORS.shirt[(colorSeed + 3) % RIDER_COLORS.shirt.length];
      
      // Walking animation (faster when moving)
      const walkSpeed = guestProgress > 0.1 && guestProgress < 0.9 ? 0.3 : 0.1;
      const walkCycle = Math.sin((tick * walkSpeed + i * 2) * 2);
      const bobY = Math.abs(walkCycle) * 0.6 * scale;
      
      // Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.beginPath();
      ctx.ellipse(guestX, guestY + 1 * scale, 2 * scale, 1 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Legs
      ctx.fillStyle = '#1e293b';
      const legWidth = 0.8 * scale;
      const legHeight = 2 * scale;
      ctx.fillRect(guestX - 1 * scale, guestY - 3 * scale - bobY, legWidth, legHeight);
      ctx.fillRect(guestX + 0.2 * scale, guestY - 3 * scale - bobY, legWidth, legHeight);
      
      // Body
      ctx.fillStyle = shirtColor;
      ctx.fillRect(guestX - 1.5 * scale, guestY - 5 * scale - bobY, 3 * scale, 2.5 * scale);
      
      // Head
      ctx.fillStyle = skinColor;
      ctx.beginPath();
      ctx.arc(guestX, guestY - 6.5 * scale - bobY, 1.5 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// Helper to darken a hex color
function darkenColor(hex: string, factor: number = 0.2): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.floor(r * (1 - factor))}, ${Math.floor(g * (1 - factor))}, ${Math.floor(b * (1 - factor))})`;
}

// Draw riders in a car (shared helper)
function drawRiders(
  ctx: CanvasRenderingContext2D,
  riderPositions: { rx: number; ry: number }[],
  guestCount: number,
  carIndex: number,
  isLoading: boolean,
  tick: number,
  yOffset: number = 0
) {
  const ridersToShow = Math.min(guestCount, riderPositions.length);
  if (ridersToShow <= 0) return;
  
  for (let i = 0; i < ridersToShow; i++) {
    const pos = riderPositions[i];
    const colorSeed = (carIndex * 7 + i * 13) % 100;
    const skinColor = RIDER_COLORS.skin[colorSeed % RIDER_COLORS.skin.length];
    const shirtColor = RIDER_COLORS.shirt[(colorSeed + 3) % RIDER_COLORS.shirt.length];
    const loadingBob = isLoading ? Math.sin(tick * 0.15 + i * 1.5) * 0.8 : 0;
    
    // Rider head
    ctx.fillStyle = skinColor;
    ctx.beginPath();
    ctx.arc(pos.rx, pos.ry - 2 + loadingBob + yOffset, 1.2, 0, Math.PI * 2);
    ctx.fill();
    
    // Rider body
    ctx.fillStyle = shirtColor;
    ctx.fillRect(pos.rx - 0.8, pos.ry - 0.8 + loadingBob + yOffset, 1.6, 1.2);
  }
  
  // Raised hands animation when not loading
  if (!isLoading && ridersToShow >= 2) {
    const armWave = Math.sin(tick * 0.2) * 0.5;
    ctx.strokeStyle = RIDER_COLORS.skin[(carIndex * 7) % RIDER_COLORS.skin.length];
    ctx.lineWidth = 0.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(riderPositions[0].rx - 0.5, riderPositions[0].ry - 2.5 + yOffset);
    ctx.lineTo(riderPositions[0].rx - 1.5, riderPositions[0].ry - 3.5 + armWave + yOffset);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(riderPositions[0].rx + 0.5, riderPositions[0].ry - 2.5 + yOffset);
    ctx.lineTo(riderPositions[0].rx + 1.5, riderPositions[0].ry - 3.5 - armWave + yOffset);
    ctx.stroke();
  }
}

// Draw a standard steel coaster car
function drawSteelCar(ctx: CanvasRenderingContext2D, carLength: number, carWidth: number, primaryColor: string, isLoading: boolean, guestCount: number, carIndex: number, tick: number) {
  const darkerColor = darkenColor(primaryColor, 0.3);
  
  // Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 4, carLength * 0.45, carWidth * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Main body
  ctx.fillStyle = isLoading ? darkerColor : primaryColor;
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
  ctx.fillStyle = darkerColor;
  ctx.fillRect(-carLength * 0.45, -carWidth * 0.8, carLength * 0.25, carWidth * 1.6);
  
  // Stripe highlight
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(-carLength * 0.15, -carWidth * 0.9, carLength * 0.4, carWidth * 0.3);
  ctx.fillRect(-carLength * 0.15, carWidth * 0.6, carLength * 0.4, carWidth * 0.3);
  
  // Front detail
  ctx.fillStyle = '#1f2937';
  ctx.beginPath();
  ctx.arc(carLength * 0.3, 0, carWidth * 0.4, 0, Math.PI * 2);
  ctx.fill();
  
  // Riders
  const riderPositions = [
    { rx: -carLength * 0.15, ry: -carWidth * 0.4 },
    { rx: -carLength * 0.15, ry: carWidth * 0.4 },
    { rx: carLength * 0.1, ry: -carWidth * 0.4 },
    { rx: carLength * 0.1, ry: carWidth * 0.4 },
  ];
  drawRiders(ctx, riderPositions, guestCount, carIndex, isLoading, tick);
}

// Draw a wooden coaster car (classic boxy train)
function drawWoodenCar(ctx: CanvasRenderingContext2D, carLength: number, carWidth: number, primaryColor: string, isLoading: boolean, guestCount: number, carIndex: number, tick: number) {
  // Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 4, carLength * 0.5, carWidth * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Wooden body - boxy shape
  ctx.fillStyle = isLoading ? '#6b4423' : '#8B5A2B';
  ctx.fillRect(-carLength * 0.45, -carWidth, carLength * 0.9, carWidth * 2);
  
  // Wood grain lines
  ctx.strokeStyle = '#5c4033';
  ctx.lineWidth = 0.5;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(-carLength * 0.4, carWidth * 0.3 * i);
    ctx.lineTo(carLength * 0.4, carWidth * 0.3 * i);
    ctx.stroke();
  }
  
  // Gold/brass trim
  ctx.fillStyle = '#d4a017';
  ctx.fillRect(-carLength * 0.48, -carWidth, carLength * 0.06, carWidth * 2);
  ctx.fillRect(carLength * 0.42, -carWidth, carLength * 0.06, carWidth * 2);
  
  // Top rail
  ctx.fillStyle = '#654321';
  ctx.fillRect(-carLength * 0.45, -carWidth - 0.8, carLength * 0.9, 1.2);
  
  // Riders
  const riderPositions = [
    { rx: -carLength * 0.2, ry: -carWidth * 0.5 },
    { rx: -carLength * 0.2, ry: carWidth * 0.5 },
    { rx: carLength * 0.15, ry: -carWidth * 0.5 },
    { rx: carLength * 0.15, ry: carWidth * 0.5 },
  ];
  drawRiders(ctx, riderPositions, guestCount, carIndex, isLoading, tick);
}

// Draw a water coaster log
function drawLogCar(ctx: CanvasRenderingContext2D, carLength: number, carWidth: number, isLoading: boolean, guestCount: number, carIndex: number, tick: number) {
  // Water splash effect when moving
  if (!isLoading) {
    ctx.fillStyle = 'rgba(135, 206, 235, 0.4)';
    const splashOffset = Math.sin(tick * 0.3) * 2;
    ctx.beginPath();
    ctx.ellipse(carLength * 0.5, 2, 4 + splashOffset, 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Shadow in water
  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.beginPath();
  ctx.ellipse(0, 5, carLength * 0.5, carWidth * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Log body - elongated oval/cylinder shape
  ctx.fillStyle = isLoading ? '#5c4033' : '#6b4423';
  ctx.beginPath();
  ctx.ellipse(0, 0, carLength * 0.5, carWidth * 1.2, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Bark texture rings
  ctx.strokeStyle = '#4a3728';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.ellipse(-carLength * 0.3, 0, carWidth * 0.6, carWidth * 0.8, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(carLength * 0.2, 0, carWidth * 0.5, carWidth * 0.7, 0, 0, Math.PI * 2);
  ctx.stroke();
  
  // Hollow interior
  ctx.fillStyle = '#3d2817';
  ctx.beginPath();
  ctx.ellipse(0, -0.5, carLength * 0.35, carWidth * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Riders sit inside the log
  const riderPositions = [
    { rx: -carLength * 0.2, ry: 0 },
    { rx: carLength * 0.1, ry: 0 },
  ];
  drawRiders(ctx, riderPositions, Math.min(guestCount, 2), carIndex, isLoading, tick, -1);
}

// Draw a mine train cart
function drawMineCar(ctx: CanvasRenderingContext2D, carLength: number, carWidth: number, primaryColor: string, isLoading: boolean, guestCount: number, carIndex: number, tick: number) {
  // Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 4, carLength * 0.45, carWidth * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Cart body - trapezoidal bucket shape
  ctx.fillStyle = isLoading ? '#5c5c5c' : '#707070';
  ctx.beginPath();
  ctx.moveTo(-carLength * 0.35, -carWidth * 0.8);
  ctx.lineTo(carLength * 0.35, -carWidth * 0.8);
  ctx.lineTo(carLength * 0.45, carWidth);
  ctx.lineTo(-carLength * 0.45, carWidth);
  ctx.closePath();
  ctx.fill();
  
  // Rust streaks
  ctx.fillStyle = '#8b4513';
  ctx.fillRect(-carLength * 0.2, -carWidth * 0.5, carLength * 0.08, carWidth * 1.2);
  ctx.fillRect(carLength * 0.1, -carWidth * 0.3, carLength * 0.06, carWidth);
  
  // Metal rim
  ctx.strokeStyle = '#4a4a4a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-carLength * 0.35, -carWidth * 0.8);
  ctx.lineTo(carLength * 0.35, -carWidth * 0.8);
  ctx.stroke();
  
  // Wheels
  ctx.fillStyle = '#333';
  ctx.beginPath();
  ctx.arc(-carLength * 0.3, carWidth * 0.9, 2, 0, Math.PI * 2);
  ctx.arc(carLength * 0.3, carWidth * 0.9, 2, 0, Math.PI * 2);
  ctx.fill();
  
  // Riders
  const riderPositions = [
    { rx: -carLength * 0.15, ry: -carWidth * 0.3 },
    { rx: -carLength * 0.15, ry: carWidth * 0.3 },
    { rx: carLength * 0.15, ry: -carWidth * 0.3 },
    { rx: carLength * 0.15, ry: carWidth * 0.3 },
  ];
  drawRiders(ctx, riderPositions, guestCount, carIndex, isLoading, tick);
}

// Draw an inverted coaster car (hanging beneath track)
function drawInvertedCar(ctx: CanvasRenderingContext2D, carLength: number, carWidth: number, primaryColor: string, isLoading: boolean, guestCount: number, carIndex: number, tick: number) {
  const darkerColor = darkenColor(primaryColor, 0.3);
  
  // Hanging struts going UP to the track
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-carLength * 0.2, -carWidth - 4);
  ctx.lineTo(-carLength * 0.2, -carWidth - 8);
  ctx.moveTo(carLength * 0.2, -carWidth - 4);
  ctx.lineTo(carLength * 0.2, -carWidth - 8);
  ctx.stroke();
  
  // Shadow below car
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 6, carLength * 0.4, carWidth * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Main car body - sleek, aerodynamic
  ctx.fillStyle = isLoading ? darkerColor : primaryColor;
  ctx.beginPath();
  ctx.moveTo(-carLength * 0.4, -carWidth);
  ctx.quadraticCurveTo(carLength * 0.5, -carWidth * 1.2, carLength * 0.4, 0);
  ctx.quadraticCurveTo(carLength * 0.5, carWidth * 1.2, -carLength * 0.4, carWidth);
  ctx.lineTo(-carLength * 0.4, -carWidth);
  ctx.fill();
  
  // Canopy/windshield
  ctx.fillStyle = 'rgba(100, 100, 100, 0.7)';
  ctx.beginPath();
  ctx.ellipse(carLength * 0.1, 0, carLength * 0.2, carWidth * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Riders with dangling legs
  const riderPositions = [
    { rx: -carLength * 0.1, ry: -carWidth * 0.4 },
    { rx: -carLength * 0.1, ry: carWidth * 0.4 },
  ];
  drawRiders(ctx, riderPositions, Math.min(guestCount, 2), carIndex, isLoading, tick);
  
  // Draw dangling legs
  if (guestCount > 0) {
    const legSwing = Math.sin(tick * 0.15) * 0.5;
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 1;
    for (let i = 0; i < Math.min(guestCount, 2); i++) {
      const pos = riderPositions[i];
      ctx.beginPath();
      ctx.moveTo(pos.rx, pos.ry + 1);
      ctx.lineTo(pos.rx + legSwing, pos.ry + 4);
      ctx.stroke();
    }
  }
}

// Draw a bobsled car
function drawBobsledCar(ctx: CanvasRenderingContext2D, carLength: number, carWidth: number, primaryColor: string, isLoading: boolean, guestCount: number, carIndex: number, tick: number) {
  // Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 4, carLength * 0.5, carWidth * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Sleek bobsled body
  ctx.fillStyle = isLoading ? darkenColor(primaryColor, 0.3) : primaryColor;
  ctx.beginPath();
  ctx.moveTo(-carLength * 0.5, 0);
  ctx.quadraticCurveTo(-carLength * 0.4, -carWidth * 1.2, 0, -carWidth);
  ctx.quadraticCurveTo(carLength * 0.4, -carWidth * 0.8, carLength * 0.5, 0);
  ctx.quadraticCurveTo(carLength * 0.4, carWidth * 0.8, 0, carWidth);
  ctx.quadraticCurveTo(-carLength * 0.4, carWidth * 1.2, -carLength * 0.5, 0);
  ctx.fill();
  
  // Racing stripe
  ctx.fillStyle = '#fff';
  ctx.fillRect(-carLength * 0.3, -1, carLength * 0.6, 2);
  
  // Front nose
  ctx.fillStyle = '#333';
  ctx.beginPath();
  ctx.ellipse(carLength * 0.45, 0, carLength * 0.08, carWidth * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Riders in single file
  const riderPositions = [
    { rx: -carLength * 0.25, ry: 0 },
    { rx: 0, ry: 0 },
    { rx: carLength * 0.2, ry: 0 },
  ];
  drawRiders(ctx, riderPositions, Math.min(guestCount, 3), carIndex, isLoading, tick);
}

// Draw a flying coaster car (prone position)
function drawFlyingCar(ctx: CanvasRenderingContext2D, carLength: number, carWidth: number, primaryColor: string, isLoading: boolean, guestCount: number, carIndex: number, tick: number) {
  const darkerColor = darkenColor(primaryColor, 0.3);
  
  // Hanging mechanism
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -carWidth - 6);
  ctx.lineTo(0, -carWidth - 10);
  ctx.stroke();
  
  // Wing-like body
  ctx.fillStyle = isLoading ? darkerColor : primaryColor;
  ctx.beginPath();
  ctx.moveTo(-carLength * 0.5, 0);
  ctx.quadraticCurveTo(-carLength * 0.3, -carWidth * 1.5, carLength * 0.2, -carWidth);
  ctx.lineTo(carLength * 0.5, 0);
  ctx.lineTo(carLength * 0.2, carWidth);
  ctx.quadraticCurveTo(-carLength * 0.3, carWidth * 1.5, -carLength * 0.5, 0);
  ctx.fill();
  
  // Prone riders (flat, looking down)
  ctx.fillStyle = RIDER_COLORS.shirt[(carIndex * 7) % RIDER_COLORS.shirt.length];
  ctx.fillRect(-carLength * 0.2, -carWidth * 0.3, carLength * 0.3, carWidth * 0.6);
  
  // Rider heads
  ctx.fillStyle = RIDER_COLORS.skin[(carIndex * 7) % RIDER_COLORS.skin.length];
  ctx.beginPath();
  ctx.arc(carLength * 0.2, 0, 1.5, 0, Math.PI * 2);
  ctx.fill();
}

// Draw a wing coaster car (seats on either side)
function drawWingCar(ctx: CanvasRenderingContext2D, carLength: number, carWidth: number, primaryColor: string, isLoading: boolean, guestCount: number, carIndex: number, tick: number) {
  const darkerColor = darkenColor(primaryColor, 0.3);
  
  // Center spine
  ctx.fillStyle = '#333';
  ctx.fillRect(-carLength * 0.35, -1.5, carLength * 0.7, 3);
  
  // Left wing seat
  ctx.fillStyle = isLoading ? darkerColor : primaryColor;
  ctx.beginPath();
  ctx.ellipse(-carLength * 0.1, -carWidth * 1.5, carLength * 0.25, carWidth * 0.8, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Right wing seat
  ctx.beginPath();
  ctx.ellipse(-carLength * 0.1, carWidth * 1.5, carLength * 0.25, carWidth * 0.8, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Riders on wings
  const riderPositions = [
    { rx: -carLength * 0.1, ry: -carWidth * 1.5 },
    { rx: -carLength * 0.1, ry: carWidth * 1.5 },
  ];
  drawRiders(ctx, riderPositions, Math.min(guestCount, 2), carIndex, isLoading, tick);
}

function drawCoasterCar(
  ctx: CanvasRenderingContext2D, 
  x: number, 
  y: number, 
  direction: string,
  pitch: number = 0,
  carIndex: number = 0,
  isLoading: boolean = false,
  guestCount: number = 4,
  tick: number = 0,
  coasterType: CoasterType = 'steel_sit_down',
  primaryColor: string = '#dc2626'
) {
  const yawAngle = DIRECTION_ANGLES[direction] ?? 0;
  
  // Car dimensions
  const carLength = 10;
  const carWidth = 2.8;
  
  const pitchScale = Math.cos(pitch);
  const pitchYOffset = Math.sin(pitch) * carLength * 0.3;
  
  ctx.save();
  ctx.translate(x, y + pitchYOffset);
  ctx.rotate(yawAngle);
  
  if (Math.abs(pitch) > 0.01) {
    ctx.scale(1, Math.max(0.3, pitchScale));
  }
  
  // Dispatch to appropriate drawing function based on coaster type
  switch (coasterType) {
    case 'wooden_classic':
    case 'wooden_twister':
      drawWoodenCar(ctx, carLength, carWidth, primaryColor, isLoading, guestCount, carIndex, tick);
      break;
    case 'water_coaster':
      drawLogCar(ctx, carLength, carWidth, isLoading, guestCount, carIndex, tick);
      break;
    case 'mine_train':
      drawMineCar(ctx, carLength, carWidth, primaryColor, isLoading, guestCount, carIndex, tick);
      break;
    case 'steel_inverted':
      drawInvertedCar(ctx, carLength, carWidth, primaryColor, isLoading, guestCount, carIndex, tick);
      break;
    case 'bobsled':
      drawBobsledCar(ctx, carLength, carWidth, primaryColor, isLoading, guestCount, carIndex, tick);
      break;
    case 'steel_flying':
      drawFlyingCar(ctx, carLength, carWidth, primaryColor, isLoading, guestCount, carIndex, tick);
      break;
    case 'steel_wing':
      drawWingCar(ctx, carLength, carWidth, primaryColor, isLoading, guestCount, carIndex, tick);
      break;
    default:
      // All other steel coasters use standard car with their primary color
      drawSteelCar(ctx, carLength, carWidth, primaryColor, isLoading, guestCount, carIndex, tick);
      break;
  }
  
  // Loading indicator - small blinking light when loading
  if (isLoading) {
    const blink = Math.sin(tick * 0.3) > 0;
    if (blink) {
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(-carLength * 0.35, -carWidth - 1.5, 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
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
  isMobile?: boolean;
}

export function CoasterGrid({
  selectedTile,
  setSelectedTile,
  navigationTarget,
  onNavigationComplete,
  onViewportChange,
  isMobile = false,
}: CoasterGridProps) {
  const { state, latestStateRef, placeAtTile, bulldozeTile, placeTrackLine } = useCoaster();
  const { grid, gridSize, selectedTool, tick, coasters } = state;
  
  // Create a lookup map from coaster ID to colors and category for track rendering
  const coasterInfoMap = useMemo(() => {
    const map = new Map<string, { 
      colors: { primary: string; secondary: string; supports: string };
      category: CoasterCategory;
    }>();
    for (const coaster of coasters) {
      map.set(coaster.id, {
        colors: coaster.color,
        category: getCoasterCategory(coaster.type),
      });
    }
    return map;
  }, [coasters]);
  
  // Helper functions for track direction calculations (matching CoasterContext.tsx logic)
  const getExitDirection = useCallback((piece: { type: string; direction: 'north' | 'east' | 'south' | 'west' }): 'north' | 'east' | 'south' | 'west' => {
    const { type, direction } = piece;
    
    if (type === 'turn_right_flat' || type === 'turn_right_large_flat') {
      const rightTurn: Record<'north' | 'east' | 'south' | 'west', 'north' | 'east' | 'south' | 'west'> = {
        north: 'east', east: 'south', south: 'west', west: 'north'
      };
      return rightTurn[direction];
    }
    
    if (type === 'turn_left_flat' || type === 'turn_left_large_flat') {
      const leftTurn: Record<'north' | 'east' | 'south' | 'west', 'north' | 'east' | 'south' | 'west'> = {
        north: 'west', west: 'south', south: 'east', east: 'north'
      };
      return leftTurn[direction];
    }
    
    return direction;
  }, []);
  
  const getDirectionOffset = useCallback((dir: 'north' | 'east' | 'south' | 'west'): { dx: number; dy: number } => {
    const offsets: Record<'north' | 'east' | 'south' | 'west', { dx: number; dy: number }> = {
      north: { dx: -1, dy: 0 },
      south: { dx: 1, dy: 0 },
      east: { dx: 0, dy: -1 },
      west: { dx: 0, dy: 1 },
    };
    return offsets[dir];
  }, []);
  
  // Compute incomplete track endpoints for warning indicators
  const incompleteTrackEnds = useMemo(() => {
    const ends: { x: number; y: number; coasterId: string; coasterName: string }[] = [];
    
    for (const coaster of coasters) {
      const { track, trackTiles } = coaster;
      
      // Need at least 4 pieces to form a loop
      if (track.length < 4 || trackTiles.length < 4) {
        // If there's at least 1 tile, mark the last one as incomplete
        if (trackTiles.length > 0 && track.length > 0) {
          const lastTile = trackTiles[trackTiles.length - 1];
          ends.push({ 
            x: lastTile.x, 
            y: lastTile.y, 
            coasterId: coaster.id,
            coasterName: coaster.name 
          });
        }
        continue;
      }
      
      // Check if track forms a complete loop
      const firstTile = trackTiles[0];
      const lastTile = trackTiles[trackTiles.length - 1];
      const lastPiece = track[track.length - 1];
      
      const exitDir = getExitDirection(lastPiece);
      const offset = getDirectionOffset(exitDir);
      const exitX = lastTile.x + offset.dx;
      const exitY = lastTile.y + offset.dy;
      
      // If exit doesn't lead back to first tile, track is incomplete
      if (exitX !== firstTile.x || exitY !== firstTile.y) {
        ends.push({ 
          x: lastTile.x, 
          y: lastTile.y, 
          coasterId: coaster.id,
          coasterName: coaster.name 
        });
      }
    }
    
    return ends;
  }, [coasters, getExitDirection, getDirectionOffset]);
  
  // Check if current tool supports drag-to-draw
  const isTrackDragTool = useMemo(() => TRACK_DRAG_TOOLS.includes(selectedTool), [selectedTool]);
  const isSceneryDragTool = useMemo(() => SCENERY_DRAG_TOOLS.includes(selectedTool), [selectedTool]);
  const isDragTool = isTrackDragTool || isSceneryDragTool;
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lightingCanvasRef = useRef<HTMLCanvasElement>(null);
  const cloudCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Cloud system refs
  const cloudsRef = useRef<Cloud[]>([]);
  const cloudIdRef = useRef(0);
  const cloudSpawnTimerRef = useRef(0);
  
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
  
  // Load sprite sheets in parallel for faster loading
  useEffect(() => {
    const loadSheets = async () => {
      const loadPromises = COASTER_SPRITE_PACK.sheets.map(sheet => 
        new Promise<{ id: string; canvas: HTMLCanvasElement } | null>((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            const filtered = filterBackgroundColor(img);
            resolve({ id: sheet.id, canvas: filtered });
          };
          img.onerror = () => {
            console.error(`Failed to load sprite sheet ${sheet.id}`);
            resolve(null);
          };
          img.src = sheet.src;
        })
      );
      
      const results = await Promise.all(loadPromises);
      const newSheets = new Map<string, HTMLCanvasElement>();
      for (const result of results) {
        if (result) {
          newSheets.set(result.id, result.canvas);
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
  
  // Cloud system
  const { updateClouds, drawClouds } = useCoasterCloudSystem(
    {
      canvasWidth: canvasSize.width,
      canvasHeight: canvasSize.height,
      offset,
      zoom,
      hour: state.hour,
      isMobile,
    },
    {
      cloudsRef,
      cloudIdRef,
      cloudSpawnTimerRef,
    }
  );
  
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
    // Use larger margins to account for:
    // - Elevated tracks (height * HEIGHT_UNIT = 20px per level, max ~10+ levels = 200+ px)
    // - Support structures extending downward from elevated tracks
    // - Loop tracks that extend well beyond tile bounds (radius up to 60+ px)
    // - Isometric projection causing horizontal spread
    const CULL_MARGIN_X = TILE_WIDTH * 4;
    const CULL_MARGIN_TOP = TILE_HEIGHT + 400; // Large margin for tall elevated elements
    const CULL_MARGIN_BOTTOM = TILE_HEIGHT * 3; // Extra for supports and sprites
    const viewLeft = -offset.x / zoom - CULL_MARGIN_X;
    const viewTop = -offset.y / zoom - CULL_MARGIN_TOP;
    const viewRight = canvasSize.width / zoom - offset.x / zoom + CULL_MARGIN_X;
    const viewBottom = canvasSize.height / zoom - offset.y / zoom + CULL_MARGIN_BOTTOM;
    
    const guestsByTile = new Map<string, typeof state.guests>();
    state.guests.forEach(guest => {
      // Use effective tile position for z-ordering:
      // If progress >= 0.5, guest visually appears on target tile
      const effectiveX = guest.progress >= 0.5 ? guest.targetTileX : guest.tileX;
      const effectiveY = guest.progress >= 0.5 ? guest.targetTileY : guest.tileY;
      const key = `${effectiveX},${effectiveY}`;
      const existing = guestsByTile.get(key);
      if (existing) {
        existing.push(guest);
      } else {
        guestsByTile.set(key, [guest]);
      }
    });
    
    // Enhanced car data with loading state, guest info, and pitch for slopes
    interface CarRenderData {
      x: number;
      y: number;
      direction: string;
      pitch: number; // Pitch angle in radians for slopes
      carIndex: number;
      isLoading: boolean;
      guestCount: number;
      coasterType: CoasterType;
      primaryColor: string;
    }
    const carsByTile = new Map<string, CarRenderData[]>();
    
    // Track station tiles with loading trains for boarding animation
    interface StationLoadingData {
      x: number;
      y: number;
      isBoarding: boolean;
      loadingProgress: number;
      guestCount: number;
    }
    const stationLoadingData: StationLoadingData[] = [];
    
    state.coasters.forEach(coaster => {
      if (coaster.track.length === 0 || coaster.trackTiles.length === 0) return;
      
      // Validate that this coaster's track still exists in the grid
      // Skip rendering if the track tiles don't match the grid state
      const hasValidTrack = coaster.trackTiles.some(tile => {
        const gridTile = state.grid[tile.y]?.[tile.x];
        return gridTile?.coasterTrackId === coaster.id && gridTile?.trackPiece;
      });
      if (!hasValidTrack) return;
      
      const trackLen = coaster.track.length;
      
      // Check if this coaster has an adjacent queue - if not, no guests can ride
      const coasterHasQueue = hasAdjacentQueue(
        state.grid,
        coaster.stationTileX,
        coaster.stationTileY,
        state.gridSize
      );
      
      coaster.trains.forEach(train => {
        const isLoading = train.state === 'loading' || train.state === 'dispatching';
        
        // Track station loading for boarding animation
        // Use the coaster's designated station tile (which should have an adjacent queue)
        // Only show guests if the coaster has an adjacent queue
        if (isLoading && coasterHasQueue) {
          const stationX = coaster.stationTileX;
          const stationY = coaster.stationTileY;
          const loadingDuration = 8; // Approximate loading duration
          const progress = Math.max(0, Math.min(1, 1 - (train.stateTimer / loadingDuration)));
          stationLoadingData.push({
            x: stationX,
            y: stationY,
            isBoarding: train.state === 'loading',
            loadingProgress: progress,
            guestCount: 4 * train.cars.length, // Approximate guests loading
          });
        }
        
        train.cars.forEach((car, carIdx) => {
          // Skip cars with invalid progress values
          if (!Number.isFinite(car.trackProgress)) return;
          
          // Handle negative track progress by wrapping around
          let normalizedProgress = car.trackProgress % trackLen;
          if (normalizedProgress < 0) normalizedProgress += trackLen;
          
          // Extra validation - skip if progress is somehow still invalid
          if (!Number.isFinite(normalizedProgress) || normalizedProgress < 0) return;

          const trackIndex = Math.floor(normalizedProgress);
          const t = normalizedProgress - trackIndex;
          
          // Skip if trackIndex is out of bounds
          if (trackIndex < 0 || trackIndex >= trackLen) return;
          
          const trackTile = coaster.trackTiles[trackIndex];
          if (!trackTile) return;
          
          // Get the ACTUAL track piece from the grid (not the cached one in coaster.track)
          // This ensures the car is positioned on the track as it's actually drawn
          const gridTile = state.grid[trackTile.y]?.[trackTile.x];
          if (!gridTile?.trackPiece || gridTile.coasterTrackId !== coaster.id) return;
          
          // Use the grid's track piece for positioning to match the rendered track
          const actualTrackPiece = gridTile.trackPiece;

          const { screenX, screenY } = gridToScreen(trackTile.x, trackTile.y, 0, 0);
          const centerX = screenX + TILE_WIDTH / 2;
          const centerY = screenY + TILE_HEIGHT / 2;
          const pos = getTrackPoint(actualTrackPiece, centerX, centerY, t);
          
          // Calculate actual travel direction based on track piece type and position
          const travelDirection = getCarTravelDirection(actualTrackPiece, coaster.trackTiles, trackIndex, t);

          const key = `${trackTile.x},${trackTile.y}`;
          const existing = carsByTile.get(key);
          // Only show guests if the coaster has an adjacent queue
          const baseGuestCount = car.guests.length > 0 ? car.guests.length : 4;
          const carData: CarRenderData = { 
            x: pos.x, 
            y: pos.y,
            pitch: pos.pitch,
            direction: travelDirection,
            carIndex: carIdx,
            isLoading,
            guestCount: coasterHasQueue ? baseGuestCount : 0, // No guests without queue
            coasterType: coaster.type,
            primaryColor: coaster.color.primary,
          };
          if (existing) {
            existing.push(carData);
          } else {
            carsByTile.set(key, [carData]);
          }
        });
      });
    });
    
    // Create a lookup for station loading data by tile
    const stationLoadingByTile = new Map<string, StationLoadingData>();
    stationLoadingData.forEach(data => {
      stationLoadingByTile.set(`${data.x},${data.y}`, data);
    });
    
    // Map from "front corner" position to multi-tile building info
    // This allows us to draw multi-tile buildings at the correct depth in the main loop
    const multiTileBuildingsByFrontCorner = new Map<string, { 
      type: string; 
      anchorX: number; 
      anchorY: number;
      width: number;
      height: number;
    }>();
    
    // First pass: identify all multi-tile buildings and map them by their front corner
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const tile = grid[y][x];
        const buildingType = tile.building?.type;
        if (buildingType && !buildingType.endsWith('_footprint')) {
          const toolInfo = TOOL_INFO[buildingType as Tool];
          const buildingSize = toolInfo?.size ?? { width: 1, height: 1 };
          if (buildingSize.width > 1 || buildingSize.height > 1) {
            // This is a multi-tile building anchor
            const frontX = x + buildingSize.width - 1;
            const frontY = y + buildingSize.height - 1;
            const key = `${frontX},${frontY}`;
            multiTileBuildingsByFrontCorner.set(key, {
              type: buildingType,
              anchorX: x,
              anchorY: y,
              width: buildingSize.width,
              height: buildingSize.height,
            });
          }
        }
      }
    }
    
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
          
          // Draw beach on water tiles at edges facing land (just like iso city)
          if (zoom >= 0.4) {
            // Check adjacent tiles for land (not water)
            const adjacentLand = {
              north: x > 0 && grid[y]?.[x - 1]?.terrain !== 'water',
              east: y > 0 && grid[y - 1]?.[x]?.terrain !== 'water',
              south: x < gridSize - 1 && grid[y]?.[x + 1]?.terrain !== 'water',
              west: y < gridSize - 1 && grid[y + 1]?.[x]?.terrain !== 'water',
            };
            
            // Only draw beach if there's at least one adjacent land tile
            if (adjacentLand.north || adjacentLand.east || adjacentLand.south || adjacentLand.west) {
              drawBeachOnWater(ctx, screenX, screenY, adjacentLand);
            }
          }
        } else if (tile.queue) {
          // Count guests in 'queuing' state on this tile
          const queueGuests = guestsByTile.get(`${x},${y}`)?.filter(g => g.state === 'queuing') || [];
          drawQueueTile(ctx, screenX, screenY, x, y, grid, gridSize, queueGuests.length, tick);
        } else if (tile.path) {
          drawPathTile(ctx, screenX, screenY, x, y, grid, gridSize);
          
          // Check if this path tile is at the edge of the map - if so, draw entrance gate
          const edgeInfo = getTileEdgeInfo(x, y, gridSize);
          if (edgeInfo.isEdge) {
            drawEntranceGate(ctx, screenX, screenY, edgeInfo, x, y);
          }
        } else {
          drawGrassTile(ctx, screenX, screenY, zoom);
        }
        
        // Draw coaster track if present
        if (tile.trackPiece) {
          // Look up the coaster's colors and category for this track
          const coasterInfo = tile.coasterTrackId ? coasterInfoMap.get(tile.coasterTrackId) : undefined;
          drawTrackSegment(ctx, tile.trackPiece, screenX, screenY, tick, coasterInfo?.colors?.primary, coasterInfo?.category);
        }
        
        // Draw building sprite if present (skip footprint tiles - they're part of multi-tile buildings)
        const spriteBuildingType = tile.building?.type;
        if (spriteBuildingType && spriteBuildingType !== 'empty' && spriteBuildingType !== 'grass' &&
            spriteBuildingType !== 'water' && spriteBuildingType !== 'path' && spriteBuildingType !== 'queue' &&
            !spriteBuildingType.endsWith('_footprint')) {
          // Check if this is a multi-tile building
          const toolInfo = TOOL_INFO[spriteBuildingType as Tool];
          const buildingSize = toolInfo?.size ?? { width: 1, height: 1 };
          const isMultiTile = buildingSize.width > 1 || buildingSize.height > 1;
          
          if (!isMultiTile) {
            // Single tile buildings: draw grey base first if needed (for shops, food stands, etc.)
            if (needsGreyBase(spriteBuildingType)) {
              drawGreyBaseTiles(ctx, x, y, 1, 1, zoom, grid, gridSize);
            }
            // Then draw the sprite
            drawSprite(ctx, spriteSheets, spriteBuildingType, screenX, screenY, x, y);
          }
          // Multi-tile buildings are drawn when we reach their front corner (see below)
        }
        
        // Check if this tile is the front corner of a multi-tile building
        // If so, draw that building now (at the correct depth in isometric order)
        const frontCornerKey = `${x},${y}`;
        const multiTileBuilding = multiTileBuildingsByFrontCorner.get(frontCornerKey);
        if (multiTileBuilding) {
          const anchorScreen = gridToScreen(multiTileBuilding.anchorX, multiTileBuilding.anchorY, 0, 0);
          
          // Draw grey base tiles for the building footprint (skipping tiles with coaster tracks)
          if (needsGreyBase(multiTileBuilding.type)) {
            drawGreyBaseTiles(
              ctx,
              multiTileBuilding.anchorX,
              multiTileBuilding.anchorY,
              multiTileBuilding.width,
              multiTileBuilding.height,
              zoom,
              grid,
              gridSize
            );
          }
          
          // Draw the building sprite
          drawSprite(
            ctx,
            spriteSheets,
            multiTileBuilding.type,
            anchorScreen.screenX,
            anchorScreen.screenY,
            multiTileBuilding.anchorX,
            multiTileBuilding.anchorY
          );
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
            drawCoasterCar(ctx, car.x, car.y, car.direction, car.pitch, car.carIndex, car.isLoading, car.guestCount, tick, car.coasterType, car.primaryColor);
          });
        }
        
        // Draw boarding/exiting guests at station tiles
        const stationLoading = stationLoadingByTile.get(`${x},${y}`);
        if (stationLoading) {
          drawBoardingGuests(
            ctx,
            screenX,
            screenY,
            stationLoading.isBoarding,
            stationLoading.guestCount,
            tick,
            stationLoading.loadingProgress
          );
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
    
    // Multi-tile building sprites are now drawn inline during the main loop
    // when we reach their "front corner" tile for correct isometric depth ordering
    
    // Draw incomplete track warnings - show pulsing warning on the open end of incomplete tracks
    for (const end of incompleteTrackEnds) {
      const { screenX, screenY } = gridToScreen(end.x, end.y, 0, 0);
      drawIncompleteTrackWarning(ctx, screenX, screenY, tick, end.coasterName);
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
  }, [grid, gridSize, offset, zoom, canvasSize, tick, selectedTile, hoveredTile, selectedTool, spriteSheets, waterImage, state.guests, state.coasters, trackDragPreviewTiles, isTrackDragging, coasterInfoMap, incompleteTrackEnds]);
  
  // Lighting canvas sizing
  useEffect(() => {
    const lightingCanvas = lightingCanvasRef.current;
    if (!lightingCanvas) return;
    
    const dpr = window.devicePixelRatio || 1;
    lightingCanvas.width = canvasSize.width * dpr;
    lightingCanvas.height = canvasSize.height * dpr;
    lightingCanvas.style.width = `${canvasSize.width}px`;
    lightingCanvas.style.height = `${canvasSize.height}px`;
  }, [canvasSize]);
  
  // Day/night lighting system
  useCoasterLightingSystem({
    canvasRef: lightingCanvasRef,
    grid,
    gridSize,
    hour: state.hour,
    offset,
    zoom,
    canvasWidth: canvasSize.width,
    canvasHeight: canvasSize.height,
  });
  
  // Cloud animation loop - runs independently for smooth cloud movement
  useEffect(() => {
    const cloudCanvas = cloudCanvasRef.current;
    if (!cloudCanvas) return;
    
    const ctx = cloudCanvas.getContext('2d');
    if (!ctx) return;
    
    const dpr = window.devicePixelRatio || 1;
    cloudCanvas.width = canvasSize.width * dpr;
    cloudCanvas.height = canvasSize.height * dpr;
    cloudCanvas.style.width = `${canvasSize.width}px`;
    cloudCanvas.style.height = `${canvasSize.height}px`;
    
    let lastTime = performance.now();
    let animationId: number;
    
    const animate = (currentTime: number) => {
      const delta = (currentTime - lastTime) / 1000; // Convert to seconds
      lastTime = currentTime;
      
      // Update clouds
      updateClouds(delta, state.speed);
      
      // Clear and draw clouds
      ctx.clearRect(0, 0, cloudCanvas.width, cloudCanvas.height);
      drawClouds(ctx);
      
      animationId = requestAnimationFrame(animate);
    };
    
    animationId = requestAnimationFrame(animate);
    
    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [canvasSize, updateClouds, drawClouds, state.speed]);
  
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
    
    // If it's a drag tool (track, scenery) and we're on a valid tile, start dragging
    if (isDragTool && isValidTile) {
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
  }, [offset, zoom, gridSize, isDragTool, selectedTool, placeAtTile, bulldozeTile, setSelectedTile]);
  
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
    <div ref={containerRef} className="w-full h-full relative">
      <canvas
        ref={canvasRef}
        className="block cursor-grab active:cursor-grabbing absolute inset-0"
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
      {/* Cloud overlay canvas - renders atmospheric clouds */}
      <canvas
        ref={cloudCanvasRef}
        className="block absolute inset-0 pointer-events-none"
      />
      {/* Lighting overlay canvas - renders day/night effects */}
      <canvas
        ref={lightingCanvasRef}
        className="block absolute inset-0 pointer-events-none"
      />
    </div>
  );
}
