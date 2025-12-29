/**
 * Shared Isometric Rendering System
 * 
 * This module provides core isometric rendering functionality that can be reused
 * across different games (IsoCity, Rise of Nations, etc.)
 */

import { TILE_WIDTH, TILE_HEIGHT } from '../types';
import { gridToScreen, screenToGrid, screenToGridRaw } from '../utils';
import { 
  drawGreenBaseTile, 
  drawGreyBaseTile, 
  drawIsometricDiamond,
  ZONE_COLORS,
  GREY_TILE_COLORS,
  TileColorScheme,
  getDiamondCorners,
} from '../drawing';
import { loadImage, loadSpriteImage, getCachedImage, onImageLoaded } from '../imageLoader';
import { WATER_ASSET_PATH } from '../constants';
import { createNoise2D } from 'simplex-noise';

// Re-export commonly used items
export {
  TILE_WIDTH,
  TILE_HEIGHT,
  gridToScreen,
  screenToGrid,
  screenToGridRaw,
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

// ============================================================================
// Realistic terrain helpers (used by RoN)
// ============================================================================

type NaturalGroundKind = 'grass' | 'dirt' | 'rock';

type NaturalPalette = {
  base: string;   // primary albedo
  tint: string;   // subtle color tint used with overlay/soft-light
  shadow: string; // darker speckle/patch tone
  stroke: string; // outline
};

const NATURAL_PALETTES: Record<NaturalGroundKind, NaturalPalette> = {
  // Temperate grass: muted, slightly olive, less “cartoon green”
  grass: {
    base: '#55663b',
    tint: '#6f7c4a',
    shadow: '#3f4a2b',
    stroke: 'rgba(25, 35, 18, 0.45)',
  },
  // Dirt: warm, not orange
  dirt: {
    base: '#7a6449',
    tint: '#8a7456',
    shadow: '#5a4834',
    stroke: 'rgba(35, 25, 18, 0.45)',
  },
  // Rock: neutral grey-brown
  rock: {
    base: '#6c6a63',
    tint: '#7a776e',
    shadow: '#4c4a44',
    stroke: 'rgba(20, 20, 20, 0.5)',
  },
};

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2D(x: number, y: number): number {
  // Deterministic, stable across sessions
  let h = Math.imul(x, 0x1f123bb5) ^ Math.imul(y, 0x6a09e667);
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

const VARIANT_COUNT = 64;
const noise2D = createNoise2D(mulberry32(133742));
const naturalTileCache = new Map<string, HTMLCanvasElement>();

function getOrCreateCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.floor(w));
  c.height = Math.max(1, Math.floor(h));
  return c;
}

function buildNaturalTileTexture(kind: NaturalGroundKind, variant: number): HTMLCanvasElement {
  const palette = NATURAL_PALETTES[kind];
  const key = `${kind}:${variant}`;
  const cached = naturalTileCache.get(key);
  if (cached) return cached;

  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const canvas = getOrCreateCanvas(w, h);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // Clip to diamond
  const corners = getDiamondCorners(0, 0, w, h);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(corners.top.x, corners.top.y);
  ctx.lineTo(corners.right.x, corners.right.y);
  ctx.lineTo(corners.bottom.x, corners.bottom.y);
  ctx.lineTo(corners.left.x, corners.left.y);
  ctx.closePath();
  ctx.clip();

  // Base fill
  ctx.fillStyle = palette.base;
  ctx.fillRect(0, 0, w, h);

  // Broad lighting (sun from top-left): subtle, realistic shading
  const light = ctx.createLinearGradient(w * 0.05, h * 0.05, w * 0.9, h * 0.9);
  light.addColorStop(0, 'rgba(255,255,255,0.10)');
  light.addColorStop(0.45, 'rgba(255,255,255,0.00)');
  light.addColorStop(1, 'rgba(0,0,0,0.14)');
  ctx.globalCompositeOperation = 'soft-light';
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, w, h);

  // Macro variation patches (avoid per-pixel loops; paint a handful of blobs)
  const rng = mulberry32(0x9e3779b9 ^ variant);
  const cx = w / 2;
  const cy = h / 2;

  ctx.globalCompositeOperation = 'overlay';
  for (let i = 0; i < 14; i++) {
    const a = rng() * Math.PI * 2;
    const r = (0.12 + rng() * 0.35) * Math.min(w, h);
    const px = cx + Math.cos(a) * (w * 0.28) * (0.2 + rng());
    const py = cy + Math.sin(a) * (h * 0.28) * (0.2 + rng());
    const sx = r * (0.7 + rng() * 0.9);
    const sy = r * (0.5 + rng() * 0.9);
    const phase = noise2D((variant + i) * 0.17, (variant - i) * 0.11);

    ctx.fillStyle = phase > 0 ? `rgba(255,255,255,${0.02 + rng() * 0.03})` : `rgba(0,0,0,${0.03 + rng() * 0.04})`;
    ctx.beginPath();
    ctx.ellipse(px, py, sx, sy, rng() * 0.8 - 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Micro speckle (rocks/grass clumps)
  ctx.globalCompositeOperation = 'multiply';
  for (let i = 0; i < 90; i++) {
    const px = rng() * w;
    const py = rng() * h;
    // Keep speckles mostly inside the diamond’s “core” for cleaner edges
    if (px < w * 0.08 || px > w * 0.92 || py < h * 0.08 || py > h * 0.92) continue;
    const s = 0.6 + rng() * 1.1;
    ctx.fillStyle = rng() > 0.55 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)';
    ctx.fillRect(px, py, s, s);
  }

  // Gentle tint pass to keep the palette cohesive
  ctx.globalCompositeOperation = 'color';
  ctx.globalAlpha = 0.10;
  ctx.fillStyle = palette.tint;
  ctx.fillRect(0, 0, w, h);

  // Restore
  ctx.restore();

  // Cache
  naturalTileCache.set(key, canvas);
  return canvas;
}

/**
 * Draw a more realistic ground tile (noise-textured + shaded).
 * Designed for RoN terrain to avoid the saturated “cartoon green” look.
 */
export function drawNaturalGroundTile(
  ctx: CanvasRenderingContext2D,
  coords: { screenX: number; screenY: number; gridX: number; gridY: number },
  kind: NaturalGroundKind = 'grass',
  zoom: number = 1
): void {
  const { screenX, screenY, gridX, gridY } = coords;
  const variant = hash2D(gridX, gridY) % VARIANT_COUNT;
  const tex = buildNaturalTileTexture(kind, variant);

  ctx.drawImage(tex, screenX, screenY);

  // Subtle outline only when zoomed in enough (prevents noisy “grid” feel)
  if (zoom >= 0.65) {
    const w = TILE_WIDTH;
    const h = TILE_HEIGHT;
    ctx.strokeStyle = NATURAL_PALETTES[kind].stroke;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(screenX + w / 2, screenY);
    ctx.lineTo(screenX + w, screenY + h / 2);
    ctx.lineTo(screenX + w / 2, screenY + h);
    ctx.lineTo(screenX, screenY + h / 2);
    ctx.closePath();
    ctx.stroke();
  }
}

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
  style: 'hover' | 'selected' | 'attack' | 'move' | 'invalid' = 'hover'
): void {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  
  // Style-specific colors
  const styles = {
    hover: { fill: 'rgba(255, 255, 255, 0.25)', stroke: '#ffffff', lineWidth: 2 },
    selected: { fill: 'rgba(34, 197, 94, 0.3)', stroke: '#22c55e', lineWidth: 2.5 },
    attack: { fill: 'rgba(239, 68, 68, 0.3)', stroke: '#ef4444', lineWidth: 2.5 },
    move: { fill: 'rgba(59, 130, 246, 0.25)', stroke: '#3b82f6', lineWidth: 2 },
    invalid: { fill: 'rgba(239, 68, 68, 0.4)', stroke: '#dc2626', lineWidth: 2.5 },
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

  // Color grade + shoreline shaping (more realistic water)
  // - Deep water: darker, cooler
  // - Near shore (missing adjacent water): lighter + subtle foam
  const shoreMissing = adjacentWater
    ? (Number(!adjacentWater.north) + Number(!adjacentWater.east) + Number(!adjacentWater.south) + Number(!adjacentWater.west))
    : 0;

  // Base depth tint
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = 0.32;
  const depth = ctx.createLinearGradient(screenX, screenY, screenX + w, screenY + h);
  depth.addColorStop(0, 'rgba(10, 20, 40, 0.75)');
  depth.addColorStop(0.55, 'rgba(10, 25, 45, 0.65)');
  depth.addColorStop(1, 'rgba(6, 12, 26, 0.85)');
  ctx.fillStyle = depth;
  ctx.fillRect(screenX, screenY, w, h);

  // Shallow tint near edges that meet land
  if (shoreMissing > 0 && adjacentWater) {
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.18 + shoreMissing * 0.03;
    const shallow = 'rgba(70, 190, 190, 0.55)';
    ctx.fillStyle = shallow;

    // Paint thin strips along missing edges (inside the clipped diamond)
    const edgeW = Math.max(2, Math.floor(w * 0.08));
    const edgeH = Math.max(2, Math.floor(h * 0.14));

    // North (top-left edge)
    if (!adjacentWater.north) {
      ctx.beginPath();
      ctx.moveTo(screenX + w * 0.02, screenY + h * 0.5);
      ctx.lineTo(screenX + w * 0.5, screenY + h * 0.02);
      ctx.lineTo(screenX + w * 0.5, screenY + h * 0.02 + edgeH);
      ctx.lineTo(screenX + w * 0.02 + edgeW, screenY + h * 0.5);
      ctx.closePath();
      ctx.fill();
    }
    // East (top-right edge)
    if (!adjacentWater.east) {
      ctx.beginPath();
      ctx.moveTo(screenX + w * 0.5, screenY + h * 0.02);
      ctx.lineTo(screenX + w * 0.98, screenY + h * 0.5);
      ctx.lineTo(screenX + w * 0.98 - edgeW, screenY + h * 0.5);
      ctx.lineTo(screenX + w * 0.5, screenY + h * 0.02 + edgeH);
      ctx.closePath();
      ctx.fill();
    }
    // South (bottom-right edge)
    if (!adjacentWater.south) {
      ctx.beginPath();
      ctx.moveTo(screenX + w * 0.98, screenY + h * 0.5);
      ctx.lineTo(screenX + w * 0.5, screenY + h * 0.98);
      ctx.lineTo(screenX + w * 0.5, screenY + h * 0.98 - edgeH);
      ctx.lineTo(screenX + w * 0.98 - edgeW, screenY + h * 0.5);
      ctx.closePath();
      ctx.fill();
    }
    // West (bottom-left edge)
    if (!adjacentWater.west) {
      ctx.beginPath();
      ctx.moveTo(screenX + w * 0.5, screenY + h * 0.98);
      ctx.lineTo(screenX + w * 0.02, screenY + h * 0.5);
      ctx.lineTo(screenX + w * 0.02 + edgeW, screenY + h * 0.5);
      ctx.lineTo(screenX + w * 0.5, screenY + h * 0.98 - edgeH);
      ctx.closePath();
      ctx.fill();
    }

    // Foam line (very subtle)
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1;
    const foamInset = 2;
    if (!adjacentWater.north) {
      ctx.beginPath();
      ctx.moveTo(screenX + foamInset, screenY + h / 2);
      ctx.lineTo(screenX + w / 2, screenY + foamInset);
      ctx.stroke();
    }
    if (!adjacentWater.east) {
      ctx.beginPath();
      ctx.moveTo(screenX + w / 2, screenY + foamInset);
      ctx.lineTo(screenX + w - foamInset, screenY + h / 2);
      ctx.stroke();
    }
    if (!adjacentWater.south) {
      ctx.beginPath();
      ctx.moveTo(screenX + w - foamInset, screenY + h / 2);
      ctx.lineTo(screenX + w / 2, screenY + h - foamInset);
      ctx.stroke();
    }
    if (!adjacentWater.west) {
      ctx.beginPath();
      ctx.moveTo(screenX + w / 2, screenY + h - foamInset);
      ctx.lineTo(screenX + foamInset, screenY + h / 2);
      ctx.stroke();
    }
  }
  
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
 * Draw fire effect on a building
 * Used when buildings are on fire (IsoCity) or under attack (RoN)
 * 
 * @param ctx - Canvas 2D rendering context (already transformed for zoom/offset)
 * @param screenX - Screen X position of the tile (from gridToScreen)
 * @param screenY - Screen Y position of the tile (from gridToScreen)
 * @param animTime - Animation time in seconds for fire flickering
 * @param intensity - Fire intensity from 0 to 1 (default 1)
 */
export function drawFireEffect(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  animTime: number,
  intensity: number = 1
): void {
  const centerX = screenX + TILE_WIDTH / 2;
  const centerY = screenY + TILE_HEIGHT / 2;
  
  const pulse = Math.sin(animTime * 6) * 0.3 + 0.7;
  const outerPulse = Math.sin(animTime * 4) * 0.5 + 0.5;
  
  // Outer pulsing ring
  ctx.beginPath();
  ctx.arc(centerX, centerY - 12, 22 + outerPulse * 8, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(239, 68, 68, ${0.3 * (1 - outerPulse) * intensity})`;
  ctx.lineWidth = 2;
  ctx.stroke();
  
  ctx.save();
  ctx.translate(centerX, centerY - 15);
  
  // Red triangle/flame base
  ctx.fillStyle = `rgba(220, 38, 38, ${0.9 * pulse * intensity})`;
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.lineTo(8, 5);
  ctx.lineTo(-8, 5);
  ctx.closePath();
  ctx.fill();
  
  // Border highlight
  ctx.strokeStyle = `rgba(252, 165, 165, ${pulse * intensity})`;
  ctx.lineWidth = 1;
  ctx.stroke();
  
  // Yellow/orange flame inner
  ctx.fillStyle = `rgba(251, 191, 36, ${intensity})`;
  ctx.beginPath();
  ctx.moveTo(0, -3);
  ctx.quadraticCurveTo(2.5, 0, 2, 2.5);
  ctx.quadraticCurveTo(0.5, 1.5, 0, 2.5);
  ctx.quadraticCurveTo(-0.5, 1.5, -2, 2.5);
  ctx.quadraticCurveTo(-2.5, 0, 0, -3);
  ctx.fill();
  
  ctx.restore();
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
