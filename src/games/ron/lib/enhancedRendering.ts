/**
 * Rise of Nations - Enhanced Rendering Integration
 * 
 * This module provides drop-in replacement functions for the standard
 * rendering in RoNCanvas, using the enhanced graphics system for
 * realistic terrain, water, and environmental effects.
 */

import { TILE_WIDTH, TILE_HEIGHT, gridToScreen } from '@/components/game/shared';
import {
  drawRealisticGrassTile,
  drawRealisticWaterTile,
  drawRealisticBeach,
  drawRealisticForest,
  drawRealisticMountain,
  drawRealisticOilDeposit,
  drawAtmosphericSky,
  REALISTIC_COLORS,
  initializeNoise,
} from './enhancedGraphics';

// ============================================================================
// Animation State
// ============================================================================

let globalAnimTime = 0;

/**
 * Update global animation time
 * Call this once per frame with delta time in seconds
 */
export function updateAnimationTime(deltaSeconds: number): void {
  globalAnimTime += deltaSeconds;
}

/**
 * Get current animation time
 */
export function getAnimationTime(): number {
  return globalAnimTime;
}

// ============================================================================
// Enhanced Terrain Rendering
// ============================================================================

/**
 * Draw an enhanced grass/ground tile with realistic textures
 * 
 * @param ctx - Canvas 2D rendering context
 * @param screenX - Screen X position
 * @param screenY - Screen Y position
 * @param gridX - Grid X coordinate
 * @param gridY - Grid Y coordinate
 * @param zoom - Current zoom level
 */
export function drawEnhancedGroundTile(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  zoom: number = 1
): void {
  drawRealisticGrassTile(ctx, screenX, screenY, gridX, gridY, zoom, globalAnimTime);
}

/**
 * Draw an enhanced water tile with animated waves and depth
 * 
 * @param ctx - Canvas 2D rendering context
 * @param screenX - Screen X position
 * @param screenY - Screen Y position
 * @param gridX - Grid X coordinate
 * @param gridY - Grid Y coordinate
 * @param adjacentWater - Which adjacent tiles are water
 * @param waterDepth - Depth factor (0 = shore, 1 = deep ocean)
 */
export function drawEnhancedWaterTile(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  adjacentWater: { north: boolean; east: boolean; south: boolean; west: boolean },
  waterDepth?: number
): void {
  // Calculate water depth based on distance from shore
  let depth = waterDepth ?? 0.5;
  
  // If adjacent to land, it's shallower
  const adjacentLandCount = [
    !adjacentWater.north,
    !adjacentWater.east,
    !adjacentWater.south,
    !adjacentWater.west
  ].filter(Boolean).length;
  
  if (waterDepth === undefined) {
    depth = 0.3 + (4 - adjacentLandCount) * 0.175; // 0.3 to 1.0 based on adjacency
  }
  
  drawRealisticWaterTile(ctx, screenX, screenY, gridX, gridY, globalAnimTime, adjacentWater, depth);
}

/**
 * Draw an enhanced beach on water tiles adjacent to land
 * 
 * @param ctx - Canvas 2D rendering context
 * @param screenX - Screen X position
 * @param screenY - Screen Y position
 * @param gridX - Grid X coordinate
 * @param gridY - Grid Y coordinate
 * @param adjacentLand - Which adjacent tiles are land
 */
export function drawEnhancedBeach(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  adjacentLand: { north: boolean; east: boolean; south: boolean; west: boolean }
): void {
  drawRealisticBeach(ctx, screenX, screenY, gridX, gridY, globalAnimTime, adjacentLand);
}

/**
 * Draw an enhanced forest tile with animated trees
 * 
 * @param ctx - Canvas 2D rendering context
 * @param screenX - Screen X position
 * @param screenY - Screen Y position
 * @param gridX - Grid X coordinate
 * @param gridY - Grid Y coordinate
 * @param forestDensity - Forest density (0-100)
 * @param zoom - Current zoom level
 */
export function drawEnhancedForest(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  forestDensity: number,
  zoom: number = 1
): void {
  // Draw base grass tile first
  drawRealisticGrassTile(ctx, screenX, screenY, gridX, gridY, zoom, globalAnimTime);
  
  // Then draw forest on top
  drawRealisticForest(ctx, screenX, screenY, gridX, gridY, forestDensity / 100, globalAnimTime, zoom);
}

/**
 * Draw an enhanced mountain/metal deposit tile
 * 
 * @param ctx - Canvas 2D rendering context
 * @param screenX - Screen X position
 * @param screenY - Screen Y position
 * @param gridX - Grid X coordinate
 * @param gridY - Grid Y coordinate
 * @param hasMetalDeposit - Whether tile has metal ore
 * @param zoom - Current zoom level
 */
export function drawEnhancedMountain(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  hasMetalDeposit: boolean,
  zoom: number = 1
): void {
  drawRealisticMountain(ctx, screenX, screenY, gridX, gridY, hasMetalDeposit, zoom, globalAnimTime);
}

/**
 * Draw an enhanced oil deposit tile
 * 
 * @param ctx - Canvas 2D rendering context
 * @param screenX - Screen X position
 * @param screenY - Screen Y position
 * @param gridX - Grid X coordinate
 * @param gridY - Grid Y coordinate
 */
export function drawEnhancedOilDeposit(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number
): void {
  // Draw grass base first
  drawRealisticGrassTile(ctx, screenX, screenY, gridX, gridY, 1, globalAnimTime);
  // Then draw oil on top
  drawRealisticOilDeposit(ctx, screenX, screenY, gridX, gridY, globalAnimTime);
}

/**
 * Draw an enhanced atmospheric sky background
 * 
 * @param ctx - Canvas 2D rendering context
 * @param canvas - Canvas element
 * @param timeOfDay - Time of day for lighting
 */
export function drawEnhancedSky(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  timeOfDay: 'day' | 'dawn' | 'dusk' | 'night' = 'day'
): void {
  drawAtmosphericSky(ctx, canvas, globalAnimTime, timeOfDay);
}

// ============================================================================
// Enhanced Tile Highlight
// ============================================================================

/**
 * Draw an enhanced tile highlight with glow effects
 */
export function drawEnhancedTileHighlight(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  style: 'hover' | 'selected' | 'attack' | 'move' | 'invalid' = 'hover'
): void {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = screenX + w / 2;
  const cy = screenY + h / 2;
  
  // Style-specific colors with glow
  const styles = {
    hover: { 
      fill: 'rgba(255, 255, 255, 0.2)', 
      stroke: '#ffffff', 
      glow: 'rgba(255, 255, 255, 0.4)',
      lineWidth: 2 
    },
    selected: { 
      fill: 'rgba(34, 197, 94, 0.25)', 
      stroke: '#22c55e', 
      glow: 'rgba(34, 197, 94, 0.5)',
      lineWidth: 2.5 
    },
    attack: { 
      fill: 'rgba(239, 68, 68, 0.25)', 
      stroke: '#ef4444', 
      glow: 'rgba(239, 68, 68, 0.5)',
      lineWidth: 2.5 
    },
    move: { 
      fill: 'rgba(59, 130, 246, 0.2)', 
      stroke: '#3b82f6', 
      glow: 'rgba(59, 130, 246, 0.4)',
      lineWidth: 2 
    },
    invalid: { 
      fill: 'rgba(239, 68, 68, 0.3)', 
      stroke: '#dc2626', 
      glow: 'rgba(220, 38, 38, 0.5)',
      lineWidth: 2.5 
    },
  };
  
  const s = styles[style];
  
  // Draw glow effect first (larger diamond)
  const glowOffset = 2;
  ctx.fillStyle = s.glow;
  ctx.beginPath();
  ctx.moveTo(cx, screenY - glowOffset);
  ctx.lineTo(screenX + w + glowOffset, cy);
  ctx.lineTo(cx, screenY + h + glowOffset);
  ctx.lineTo(screenX - glowOffset, cy);
  ctx.closePath();
  ctx.fill();
  
  // Draw main fill
  ctx.fillStyle = s.fill;
  ctx.beginPath();
  ctx.moveTo(cx, screenY);
  ctx.lineTo(screenX + w, cy);
  ctx.lineTo(cx, screenY + h);
  ctx.lineTo(screenX, cy);
  ctx.closePath();
  ctx.fill();
  
  // Draw animated border for selected/attack
  if (style === 'selected' || style === 'attack') {
    const pulseIntensity = Math.sin(globalAnimTime * 4) * 0.3 + 0.7;
    ctx.strokeStyle = s.stroke;
    ctx.lineWidth = s.lineWidth * pulseIntensity;
    ctx.globalAlpha = pulseIntensity;
    ctx.stroke();
    ctx.globalAlpha = 1;
  } else {
    ctx.strokeStyle = s.stroke;
    ctx.lineWidth = s.lineWidth;
    ctx.stroke();
  }
}

// ============================================================================
// Fishing Spot Effect
// ============================================================================

/**
 * Draw an enhanced fishing spot indicator with animated fish and ripples
 */
export function drawEnhancedFishingSpot(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number
): void {
  const cx = screenX + TILE_WIDTH / 2;
  const cy = screenY + TILE_HEIGHT / 2;
  
  // Animated ripple effect
  const phase = globalAnimTime * 2 + (gridX + gridY) * 0.3;
  
  // Draw multiple ripples
  for (let i = 0; i < 3; i++) {
    const ripplePhase = (phase + i * 0.8) % 3;
    const rippleSize = 3 + ripplePhase * 8;
    const rippleAlpha = Math.max(0, 0.5 - ripplePhase * 0.17);
    
    ctx.strokeStyle = `rgba(255, 255, 255, ${rippleAlpha})`;
    ctx.lineWidth = 1.5 - ripplePhase * 0.3;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rippleSize * 1.5, rippleSize * 0.75, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  
  // Draw fish silhouettes
  const fishCount = 2;
  for (let i = 0; i < fishCount; i++) {
    const fishPhase = phase * 0.5 + i * Math.PI;
    const fishX = cx + Math.sin(fishPhase) * 8;
    const fishY = cy + Math.cos(fishPhase * 0.7) * 4;
    const fishDir = Math.cos(fishPhase) > 0 ? 1 : -1;
    
    ctx.save();
    ctx.translate(fishX, fishY);
    ctx.scale(fishDir, 1);
    
    // Fish body
    ctx.fillStyle = 'rgba(74, 144, 164, 0.6)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 5, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Fish tail
    ctx.beginPath();
    ctx.moveTo(-5, 0);
    ctx.lineTo(-8, -2.5);
    ctx.lineTo(-8, 2.5);
    ctx.closePath();
    ctx.fill();
    
    // Eye
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.beginPath();
    ctx.arc(3, -0.5, 0.8, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  }
}

// ============================================================================
// Territory Overlay
// ============================================================================

/**
 * Draw an enhanced territory overlay with subtle pattern
 */
export function drawEnhancedTerritoryOverlay(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  playerColor: string,
  intensity: number = 0.15
): void {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = screenX + w / 2;
  const cy = screenY + h / 2;
  
  // Base territory tint
  ctx.fillStyle = playerColor + Math.floor(intensity * 255).toString(16).padStart(2, '0');
  ctx.beginPath();
  ctx.moveTo(cx, screenY);
  ctx.lineTo(screenX + w, cy);
  ctx.lineTo(cx, screenY + h);
  ctx.lineTo(screenX, cy);
  ctx.closePath();
  ctx.fill();
  
  // Add subtle pattern
  const patternAlpha = intensity * 0.3;
  ctx.fillStyle = `rgba(255, 255, 255, ${patternAlpha})`;
  
  // Draw small dots in a grid pattern
  const dotSpacing = 8;
  for (let dx = 0; dx < w; dx += dotSpacing) {
    for (let dy = 0; dy < h; dy += dotSpacing) {
      const px = screenX + dx;
      const py = screenY + dy;
      
      // Check if point is inside diamond
      const relX = (px - cx) / (w / 2);
      const relY = (py - cy) / (h / 2);
      if (Math.abs(relX) + Math.abs(relY) > 0.9) continue;
      
      ctx.beginPath();
      ctx.arc(px, py, 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize enhanced rendering system
 * Call this once at startup
 */
export function initEnhancedRendering(seed?: number): void {
  initializeNoise(seed);
  globalAnimTime = 0;
}

// Re-export colors for use in other modules
export { REALISTIC_COLORS };
