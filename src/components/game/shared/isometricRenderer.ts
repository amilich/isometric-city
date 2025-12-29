/**
 * Shared Isometric Rendering System
 * 
 * This module provides core isometric rendering functionality that can be reused
 * across different games (IsoCity, Rise of Nations, etc.)
 */

import { TILE_WIDTH, TILE_HEIGHT } from '../types';
import { gridToScreen, screenToGrid } from '../utils';
import { 
  drawGreenBaseTile, 
  drawGreyBaseTile, 
  drawIsometricDiamond,
  ZONE_COLORS,
  GREY_TILE_COLORS,
  TileColorScheme,
} from '../drawing';
import { loadImage, loadSpriteImage, getCachedImage, onImageLoaded } from '../imageLoader';
import { WATER_ASSET_PATH } from '../constants';

// Re-export commonly used items
export { 
  TILE_WIDTH, 
  TILE_HEIGHT, 
  gridToScreen, 
  screenToGrid,
  loadImage,
  loadSpriteImage,
  getCachedImage,
  onImageLoaded,
  drawGreenBaseTile,
  drawGreyBaseTile,
  drawIsometricDiamond,
  ZONE_COLORS,
  GREY_TILE_COLORS,
  WATER_ASSET_PATH,
};
export type { TileColorScheme };

/**
 * Viewport bounds for culling off-screen tiles
 */
export interface ViewBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Camera state for isometric rendering
 */
export interface IsometricCamera {
  offsetX: number;
  offsetY: number;
  zoom: number;
}

/**
 * Basic tile data required for rendering
 */
export interface RenderableTile {
  x: number;
  y: number;
  terrain?: 'grass' | 'water' | 'forest' | 'desert' | 'mountain';
  buildingType?: string;
  ownerId?: string;
  highlight?: boolean;
}

/**
 * Calculate view bounds for tile culling
 */
export function calculateViewBounds(
  canvas: HTMLCanvasElement,
  camera: IsometricCamera,
  padding: number = TILE_WIDTH * 2
): ViewBounds {
  const dpr = window.devicePixelRatio || 1;
  const viewWidth = canvas.width / (dpr * camera.zoom);
  const viewHeight = canvas.height / (dpr * camera.zoom);
  
  return {
    left: -camera.offsetX / camera.zoom - padding,
    top: -camera.offsetY / camera.zoom - padding * 2,
    right: viewWidth - camera.offsetX / camera.zoom + padding,
    bottom: viewHeight - camera.offsetY / camera.zoom + padding * 2,
  };
}

/**
 * Check if a tile position is within view bounds
 */
export function isTileVisible(
  screenX: number,
  screenY: number,
  bounds: ViewBounds
): boolean {
  return screenX >= bounds.left && screenX <= bounds.right &&
         screenY >= bounds.top && screenY <= bounds.bottom;
}

/**
 * Draw an isometric tile highlight (hover/selection)
 */
export function drawTileHighlight(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  style: 'hover' | 'selected' | 'attack' | 'move' = 'hover'
): void {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  
  // Style-specific colors
  const styles = {
    hover: { fill: 'rgba(255, 255, 255, 0.25)', stroke: '#ffffff', lineWidth: 2 },
    selected: { fill: 'rgba(34, 197, 94, 0.3)', stroke: '#22c55e', lineWidth: 2.5 },
    attack: { fill: 'rgba(239, 68, 68, 0.3)', stroke: '#ef4444', lineWidth: 2.5 },
    move: { fill: 'rgba(59, 130, 246, 0.25)', stroke: '#3b82f6', lineWidth: 2 },
  };
  
  const s = styles[style];
  
  // Draw fill
  ctx.fillStyle = s.fill;
  ctx.beginPath();
  ctx.moveTo(screenX + w / 2, screenY);
  ctx.lineTo(screenX + w, screenY + h / 2);
  ctx.lineTo(screenX + w / 2, screenY + h);
  ctx.lineTo(screenX, screenY + h / 2);
  ctx.closePath();
  ctx.fill();
  
  // Draw border
  ctx.strokeStyle = s.stroke;
  ctx.lineWidth = s.lineWidth;
  ctx.stroke();
}

/**
 * Draw a grass/ground tile with optional zone coloring
 */
export function drawGroundTile(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  zone: 'none' | 'residential' | 'commercial' | 'industrial' = 'none',
  zoom: number = 1,
  highlight: boolean = false
): void {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const colors = ZONE_COLORS[zone];
  
  // Draw the base diamond
  ctx.fillStyle = colors.top;
  ctx.beginPath();
  ctx.moveTo(screenX + w / 2, screenY);
  ctx.lineTo(screenX + w, screenY + h / 2);
  ctx.lineTo(screenX + w / 2, screenY + h);
  ctx.lineTo(screenX, screenY + h / 2);
  ctx.closePath();
  ctx.fill();
  
  // Draw grid lines when zoomed in
  if (zoom >= 0.6) {
    ctx.strokeStyle = colors.stroke;
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }
  
  // Draw zone border for zoned tiles
  if (zone !== 'none' && zoom >= 0.95) {
    ctx.strokeStyle = colors.stroke;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 2]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  
  if (highlight) {
    drawTileHighlight(ctx, screenX, screenY, 'hover');
  }
}

/**
 * Draw a water tile with texture
 */
export function drawWaterTile(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  adjacentWater?: { north: boolean; east: boolean; south: boolean; west: boolean }
): void {
  const waterImage = getCachedImage(WATER_ASSET_PATH);
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  
  if (!waterImage) {
    // Fallback: draw solid blue tile
    ctx.fillStyle = '#2563eb';
    ctx.beginPath();
    ctx.moveTo(screenX + w / 2, screenY);
    ctx.lineTo(screenX + w, screenY + h / 2);
    ctx.lineTo(screenX + w / 2, screenY + h);
    ctx.lineTo(screenX, screenY + h / 2);
    ctx.closePath();
    ctx.fill();
    return;
  }
  
  const tileCenterX = screenX + w / 2;
  const tileCenterY = screenY + h / 2;
  
  // Deterministic "random" offset based on tile position for variety
  const seedX = ((gridX * 7919 + gridY * 6271) % 1000) / 1000;
  const seedY = ((gridX * 4177 + gridY * 9311) % 1000) / 1000;
  
  const imgW = waterImage.naturalWidth || waterImage.width;
  const imgH = waterImage.naturalHeight || waterImage.height;
  
  // Take a subcrop for variety
  const cropScale = 0.35;
  const cropW = imgW * cropScale;
  const cropH = imgH * cropScale;
  const maxOffsetX = imgW - cropW;
  const maxOffsetY = imgH - cropH;
  const srcX = seedX * maxOffsetX;
  const srcY = seedY * maxOffsetY;
  
  ctx.save();
  
  // Clip to isometric diamond shape
  ctx.beginPath();
  ctx.moveTo(screenX + w / 2, screenY);
  ctx.lineTo(screenX + w, screenY + h / 2);
  ctx.lineTo(screenX + w / 2, screenY + h);
  ctx.lineTo(screenX, screenY + h / 2);
  ctx.closePath();
  ctx.clip();
  
  const aspectRatio = cropH / cropW;
  const jitterX = (seedX - 0.5) * w * 0.3;
  const jitterY = (seedY - 0.5) * h * 0.3;
  
  // Draw water texture
  const destWidth = w * 1.15;
  const destHeight = destWidth * aspectRatio;
  
  ctx.globalAlpha = 0.95;
  ctx.drawImage(
    waterImage,
    srcX, srcY, cropW, cropH,
    Math.round(tileCenterX - destWidth / 2 + jitterX * 0.3),
    Math.round(tileCenterY - destHeight / 2 + jitterY * 0.3),
    Math.round(destWidth),
    Math.round(destHeight)
  );
  
  ctx.restore();
}

/**
 * Draw a selection box (for drag-select)
 */
export function drawSelectionBox(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  endX: number,
  endY: number
): void {
  const x = Math.min(startX, endX);
  const y = Math.min(startY, endY);
  const w = Math.abs(endX - startX);
  const h = Math.abs(endY - startY);
  
  // Draw dashed border
  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(x, y, w, h);
  ctx.setLineDash([]);
  
  // Draw semi-transparent fill
  ctx.fillStyle = 'rgba(34, 197, 94, 0.15)';
  ctx.fillRect(x, y, w, h);
}

/**
 * Draw a unit circle with selection indicator
 */
export function drawUnit(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  color: string,
  isSelected: boolean,
  symbol: string = '•',
  zoom: number = 1
): void {
  const unitSize = 8 * zoom;
  const centerX = screenX + (TILE_WIDTH / 4) * zoom;
  const centerY = screenY - unitSize;
  
  // Unit body
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(centerX, centerY, unitSize, 0, Math.PI * 2);
  ctx.fill();
  
  // Selection ring
  if (isSelected) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Selection glow
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(centerX, centerY, unitSize + 3, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  
  // Symbol
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.max(8, 10 * zoom)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(symbol, centerX, centerY);
}

/**
 * Draw a health bar
 */
export function drawHealthBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  healthPercent: number,
  zoom: number = 1
): void {
  const barHeight = 3 * zoom;
  
  // Background
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(x - 1, y - 1, width + 2, barHeight + 2);
  
  // Health bar (color based on health)
  ctx.fillStyle = healthPercent > 0.5 ? '#22c55e' : healthPercent > 0.25 ? '#eab308' : '#ef4444';
  ctx.fillRect(x, y, width * healthPercent, barHeight);
}

/**
 * Draw background sky gradient
 */
export function drawSkyBackground(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  timeOfDay: 'day' | 'night' | 'dawn' | 'dusk' = 'day'
): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  
  switch (timeOfDay) {
    case 'night':
      gradient.addColorStop(0, '#0f1419');
      gradient.addColorStop(0.5, '#141c24');
      gradient.addColorStop(1, '#1a2a1f');
      break;
    case 'dawn':
      gradient.addColorStop(0, '#1a365d');
      gradient.addColorStop(0.5, '#374151');
      gradient.addColorStop(1, '#92400e');
      break;
    case 'dusk':
      gradient.addColorStop(0, '#4c1d95');
      gradient.addColorStop(0.5, '#831843');
      gradient.addColorStop(1, '#1f2937');
      break;
    default: // day
      gradient.addColorStop(0, '#1e3a5f');
      gradient.addColorStop(0.5, '#2d4a6a');
      gradient.addColorStop(1, '#1a4a2e');
  }
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

/**
 * Set up canvas for high-DPI rendering
 */
export function setupCanvas(
  canvas: HTMLCanvasElement,
  container: HTMLElement
): { width: number; height: number; dpr: number } {
  const dpr = window.devicePixelRatio || 1;
  const rect = container.getBoundingClientRect();
  
  // Set display size
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
  
  // Set actual size in memory (scaled for DPI)
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  
  return {
    width: canvas.width,
    height: canvas.height,
    dpr,
  };
}
