/**
 * Rise of Nations - Enhanced Graphics System
 * 
 * Provides realistic terrain, water, forests, mountains, and atmospheric effects.
 * Uses procedural noise for natural variation and animation.
 */

import { createNoise2D, NoiseFunction2D } from 'simplex-noise';
import { TILE_WIDTH, TILE_HEIGHT } from '@/components/game/shared';

// ============================================================================
// NOISE & RANDOMNESS
// ============================================================================

// Create noise functions (seeded for consistency)
let terrainNoise: NoiseFunction2D;
let detailNoise: NoiseFunction2D;
let waterNoise: NoiseFunction2D;
let windNoise: NoiseFunction2D;

// Initialize noise with fixed seeds for deterministic results
function initNoise() {
  if (!terrainNoise) {
    // Use deterministic pseudo-random seeding
    const seedRandom = (seed: number) => () => {
      const x = Math.sin(seed++) * 10000;
      return x - Math.floor(x);
    };
    terrainNoise = createNoise2D(seedRandom(12345));
    detailNoise = createNoise2D(seedRandom(67890));
    waterNoise = createNoise2D(seedRandom(11111));
    windNoise = createNoise2D(seedRandom(22222));
  }
}

// Get deterministic random value based on coordinates
function seededRandom(x: number, y: number, seed: number = 0): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453;
  return n - Math.floor(n);
}

// ============================================================================
// COLOR UTILITIES
// ============================================================================

// Parse hex color to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}

// Convert RGB to hex
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = Math.max(0, Math.min(255, Math.round(x))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

// Blend two colors
function blendColors(color1: string, color2: string, factor: number): string {
  const c1 = hexToRgb(color1);
  const c2 = hexToRgb(color2);
  return rgbToHex(
    c1.r + (c2.r - c1.r) * factor,
    c1.g + (c2.g - c1.g) * factor,
    c1.b + (c2.b - c1.b) * factor
  );
}

// Adjust color brightness
function adjustBrightness(color: string, amount: number): string {
  const c = hexToRgb(color);
  return rgbToHex(c.r + amount, c.g + amount, c.b + amount);
}

// ============================================================================
// REALISTIC COLOR PALETTES
// ============================================================================

// Natural grass colors (earthy, not cartoon green)
export const GRASS_PALETTE = {
  base: '#5a7247',      // Muted olive-green
  light: '#6b8354',     // Lighter grass
  dark: '#4a6238',      // Darker grass (shadows)
  dry: '#7a8a5a',       // Dry/dead grass
  lush: '#4a6a3a',      // Lush/wet grass
  earth: '#6a5a4a',     // Bare earth patches
  dirt: '#8a7a6a',      // Dirt path color
};

// Water colors with depth variation
export const WATER_PALETTE = {
  shallow: '#4a8a9a',   // Shallow coastal water (teal)
  medium: '#3a7a8a',    // Medium depth
  deep: '#2a5a7a',      // Deep water (darker blue)
  veryDeep: '#1a4a6a',  // Very deep ocean
  foam: '#c8dfe8',      // Wave foam/whitecaps
  highlight: '#6aacbc', // Sun reflection
  shadow: '#1a3a5a',    // Deep shadow
};

// Beach/sand colors
export const BEACH_PALETTE = {
  dry: '#d4c4a4',       // Dry sand (above waterline)
  wet: '#b4a484',       // Wet sand (just above water)
  submerged: '#9a9474', // Sand under shallow water
  shells: '#e8dcc8',    // Shell/light patches
  seaweed: '#5a6a4a',   // Seaweed/organic debris
};

// Mountain/rock colors
export const MOUNTAIN_PALETTE = {
  rock: '#6a6a6a',      // Base rock
  rockLight: '#8a8a8a', // Lit rock face
  rockDark: '#4a4a4a',  // Shadowed rock
  snow: '#e8ecf0',      // Snow cap
  snowShadow: '#c8d0d8',// Snow shadow
  ore: '#8a7a5a',       // Visible ore deposits
  oreGlint: '#d4b44a',  // Gold/metal glints
};

// Forest/tree colors
export const FOREST_PALETTE = {
  canopy: '#3a5a2a',    // Tree tops (darker green)
  canopyLight: '#4a6a3a', // Sunlit canopy
  trunk: '#5a4a3a',     // Tree trunks
  trunkDark: '#3a2a1a', // Dark bark
  shadow: '#2a3a1a',    // Forest floor shadow
  undergrowth: '#4a5a3a', // Bushes/undergrowth
};

// Sky/atmosphere colors by time
export const SKY_PALETTES = {
  day: {
    zenith: '#4a90c8',    // Sky at top
    horizon: '#8ac0e0',   // Sky at horizon
    ambient: '#e8f0f8',   // Ambient light color
    sunColor: '#fff8e0',  // Sunlight tint
  },
  dusk: {
    zenith: '#2a3a6a',
    horizon: '#d87040',
    ambient: '#ffd0a0',
    sunColor: '#ff8040',
  },
  night: {
    zenith: '#0a1020',
    horizon: '#1a2040',
    ambient: '#3040608',
    sunColor: '#8090b0',
  },
  dawn: {
    zenith: '#3a4a7a',
    horizon: '#e0a070',
    ambient: '#ffe0c0',
    sunColor: '#ffb080',
  },
};

// ============================================================================
// ENHANCED TERRAIN RENDERING
// ============================================================================

/**
 * Draw an enhanced grass tile with natural variation
 */
export function drawEnhancedGrassTile(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  zoom: number,
  animTime: number = 0
): void {
  initNoise();
  
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = screenX + w / 2;
  const cy = screenY + h / 2;
  
  // Get noise values for this tile (deterministic based on position)
  const noiseVal = terrainNoise(gridX * 0.3, gridY * 0.3);
  const detailVal = detailNoise(gridX * 0.8, gridY * 0.8);
  
  // Determine base grass color with natural variation
  let baseColor: string;
  if (noiseVal > 0.3) {
    baseColor = blendColors(GRASS_PALETTE.base, GRASS_PALETTE.lush, (noiseVal - 0.3) * 1.4);
  } else if (noiseVal < -0.3) {
    baseColor = blendColors(GRASS_PALETTE.base, GRASS_PALETTE.dry, (-noiseVal - 0.3) * 1.4);
  } else {
    baseColor = GRASS_PALETTE.base;
  }
  
  // Add subtle earth patches based on detail noise
  if (detailVal > 0.5) {
    baseColor = blendColors(baseColor, GRASS_PALETTE.earth, (detailVal - 0.5) * 0.4);
  }
  
  // Calculate tile corners (isometric diamond)
  const corners = {
    top: { x: cx, y: screenY },
    right: { x: screenX + w, y: cy },
    bottom: { x: cx, y: screenY + h },
    left: { x: screenX, y: cy },
  };
  
  // Create subtle gradient for 3D effect
  const gradient = ctx.createLinearGradient(corners.left.x, cy, corners.right.x, cy);
  gradient.addColorStop(0, adjustBrightness(baseColor, -15));
  gradient.addColorStop(0.5, baseColor);
  gradient.addColorStop(1, adjustBrightness(baseColor, 10));
  
  // Draw main tile
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(corners.top.x, corners.top.y);
  ctx.lineTo(corners.right.x, corners.right.y);
  ctx.lineTo(corners.bottom.x, corners.bottom.y);
  ctx.lineTo(corners.left.x, corners.left.y);
  ctx.closePath();
  ctx.fill();
  
  // Add grass texture details when zoomed in
  if (zoom >= 0.7) {
    const bladeCount = Math.floor(8 * zoom);
    ctx.strokeStyle = adjustBrightness(baseColor, 20);
    ctx.lineWidth = 0.5;
    
    for (let i = 0; i < bladeCount; i++) {
      const seed = seededRandom(gridX, gridY, i);
      const seed2 = seededRandom(gridY, gridX, i + 100);
      
      // Position within tile
      const u = seed * 0.8 + 0.1;
      const v = seed2 * 0.8 + 0.1;
      const bladeX = screenX + (u + v) * w / 2;
      const bladeY = screenY + (u - v + 1) * h / 2;
      
      // Wind sway animation
      const windSway = windNoise(gridX + animTime * 2, gridY) * 2;
      
      ctx.beginPath();
      ctx.moveTo(bladeX, bladeY);
      ctx.quadraticCurveTo(
        bladeX + windSway,
        bladeY - 2,
        bladeX + windSway * 1.5,
        bladeY - 4
      );
      ctx.stroke();
    }
  }
  
  // Subtle ambient occlusion at edges (darker)
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(corners.top.x, corners.top.y);
  ctx.lineTo(corners.right.x, corners.right.y);
  ctx.lineTo(corners.bottom.x, corners.bottom.y);
  ctx.lineTo(corners.left.x, corners.left.y);
  ctx.closePath();
  ctx.stroke();
}

// ============================================================================
// ENHANCED WATER RENDERING
// ============================================================================

/**
 * Draw an enhanced water tile with depth, waves, and reflections
 */
export function drawEnhancedWaterTile(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  zoom: number,
  animTime: number,
  waterDepth: number = 1.0, // 0 = shore, 1 = deep
  adjacentLand: { north: boolean; east: boolean; south: boolean; west: boolean } = { north: false, east: false, south: false, west: false }
): void {
  initNoise();
  
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = screenX + w / 2;
  const cy = screenY + h / 2;
  
  // Calculate how close to shore (more adjacent land = shallower)
  const landCount = [adjacentLand.north, adjacentLand.east, adjacentLand.south, adjacentLand.west].filter(Boolean).length;
  const shoreProximity = landCount / 4;
  const effectiveDepth = waterDepth * (1 - shoreProximity * 0.5);
  
  // Determine water color based on depth
  let baseColor: string;
  if (effectiveDepth < 0.3) {
    baseColor = blendColors(WATER_PALETTE.shallow, WATER_PALETTE.medium, effectiveDepth / 0.3);
  } else if (effectiveDepth < 0.7) {
    baseColor = blendColors(WATER_PALETTE.medium, WATER_PALETTE.deep, (effectiveDepth - 0.3) / 0.4);
  } else {
    baseColor = blendColors(WATER_PALETTE.deep, WATER_PALETTE.veryDeep, (effectiveDepth - 0.7) / 0.3);
  }
  
  // Tile corners
  const corners = {
    top: { x: cx, y: screenY },
    right: { x: screenX + w, y: cy },
    bottom: { x: cx, y: screenY + h },
    left: { x: screenX, y: cy },
  };
  
  // Clip to tile shape
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(corners.top.x, corners.top.y);
  ctx.lineTo(corners.right.x, corners.right.y);
  ctx.lineTo(corners.bottom.x, corners.bottom.y);
  ctx.lineTo(corners.left.x, corners.left.y);
  ctx.closePath();
  ctx.clip();
  
  // Draw base water color
  ctx.fillStyle = baseColor;
  ctx.fillRect(screenX, screenY, w, h);
  
  // Add animated wave patterns
  const waveScale = 0.15;
  const wave1 = waterNoise(gridX * waveScale + animTime * 0.5, gridY * waveScale) * 0.5 + 0.5;
  const wave2 = waterNoise(gridX * waveScale * 2 - animTime * 0.3, gridY * waveScale * 2 + animTime * 0.2) * 0.5 + 0.5;
  
  // Wave highlight pattern
  ctx.fillStyle = `rgba(106, 172, 188, ${0.15 * wave1})`;
  for (let i = 0; i < 3; i++) {
    const waveY = screenY + (wave1 * 0.5 + i * 0.33) * h;
    ctx.beginPath();
    ctx.ellipse(cx, waveY, w * 0.4, h * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Add subtle specular highlights (sun reflection)
  const specularIntensity = Math.max(0, wave1 * wave2 - 0.3);
  if (specularIntensity > 0) {
    const specGradient = ctx.createRadialGradient(
      cx + w * 0.2, cy - h * 0.2, 0,
      cx + w * 0.2, cy - h * 0.2, w * 0.3
    );
    specGradient.addColorStop(0, `rgba(255, 255, 255, ${specularIntensity * 0.4})`);
    specGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = specGradient;
    ctx.fillRect(screenX, screenY, w, h);
  }
  
  // Draw foam at shore edges
  if (landCount > 0 && zoom >= 0.5) {
    drawWaterFoam(ctx, screenX, screenY, gridX, gridY, animTime, adjacentLand);
  }
  
  ctx.restore();
}

/**
 * Draw foam/whitecaps at water edges
 */
function drawWaterFoam(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  animTime: number,
  adjacentLand: { north: boolean; east: boolean; south: boolean; west: boolean }
): void {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = screenX + w / 2;
  const cy = screenY + h / 2;
  
  const foamWidth = w * 0.12;
  const foamPulse = Math.sin(animTime * 3 + gridX + gridY) * 0.3 + 0.7;
  
  ctx.fillStyle = `rgba(200, 223, 232, ${0.6 * foamPulse})`;
  
  // Draw foam along each edge facing land
  if (adjacentLand.north) {
    // North edge (left corner to top corner)
    ctx.beginPath();
    ctx.moveTo(screenX, cy);
    ctx.lineTo(cx, screenY);
    ctx.lineTo(cx - foamWidth * 0.5, screenY + foamWidth);
    ctx.lineTo(screenX + foamWidth * 0.5, cy);
    ctx.closePath();
    ctx.fill();
  }
  
  if (adjacentLand.east) {
    // East edge (top corner to right corner)
    ctx.beginPath();
    ctx.moveTo(cx, screenY);
    ctx.lineTo(screenX + w, cy);
    ctx.lineTo(screenX + w - foamWidth * 0.5, cy);
    ctx.lineTo(cx + foamWidth * 0.5, screenY + foamWidth);
    ctx.closePath();
    ctx.fill();
  }
  
  if (adjacentLand.south) {
    // South edge (right corner to bottom corner)
    ctx.beginPath();
    ctx.moveTo(screenX + w, cy);
    ctx.lineTo(cx, screenY + h);
    ctx.lineTo(cx + foamWidth * 0.5, screenY + h - foamWidth);
    ctx.lineTo(screenX + w - foamWidth * 0.5, cy);
    ctx.closePath();
    ctx.fill();
  }
  
  if (adjacentLand.west) {
    // West edge (bottom corner to left corner)
    ctx.beginPath();
    ctx.moveTo(cx, screenY + h);
    ctx.lineTo(screenX, cy);
    ctx.lineTo(screenX + foamWidth * 0.5, cy);
    ctx.lineTo(cx - foamWidth * 0.5, screenY + h - foamWidth);
    ctx.closePath();
    ctx.fill();
  }
  
  // Add animated foam bubbles
  const bubbleCount = 3;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  for (let i = 0; i < bubbleCount; i++) {
    const seed = seededRandom(gridX, gridY, i + 500);
    const phase = (animTime * 2 + seed * Math.PI * 2) % (Math.PI * 2);
    const bubbleSize = (Math.sin(phase) * 0.5 + 0.5) * 2;
    
    const bx = cx + (seed - 0.5) * w * 0.6;
    const by = cy + (seededRandom(gridY, gridX, i + 500) - 0.5) * h * 0.6;
    
    ctx.beginPath();
    ctx.arc(bx, by, bubbleSize, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ============================================================================
// ENHANCED BEACH RENDERING
// ============================================================================

/**
 * Draw an enhanced beach strip with wet/dry gradients
 */
export function drawEnhancedBeach(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  adjacentWater: { north: boolean; east: boolean; south: boolean; west: boolean },
  animTime: number = 0
): void {
  const { north, east, south, west } = adjacentWater;
  if (!north && !east && !south && !west) return;
  
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = screenX + w / 2;
  const cy = screenY + h / 2;
  
  const beachWidth = w * 0.15;
  
  // Beach gradient from wet to dry
  const waveOffset = Math.sin(animTime * 2) * 2;
  
  // Draw beach along each edge
  const drawBeachEdge = (
    startX: number, startY: number,
    endX: number, endY: number,
    inwardDx: number, inwardDy: number
  ) => {
    // Dry sand (inner)
    ctx.fillStyle = BEACH_PALETTE.dry;
    ctx.beginPath();
    ctx.moveTo(startX + inwardDx * beachWidth * 0.5, startY + inwardDy * beachWidth * 0.5);
    ctx.lineTo(endX + inwardDx * beachWidth * 0.5, endY + inwardDy * beachWidth * 0.5);
    ctx.lineTo(endX + inwardDx * beachWidth, endY + inwardDy * beachWidth);
    ctx.lineTo(startX + inwardDx * beachWidth, startY + inwardDy * beachWidth);
    ctx.closePath();
    ctx.fill();
    
    // Wet sand (outer, near water)
    ctx.fillStyle = BEACH_PALETTE.wet;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.lineTo(endX + inwardDx * (beachWidth * 0.5 + waveOffset), endY + inwardDy * (beachWidth * 0.5 + waveOffset));
    ctx.lineTo(startX + inwardDx * (beachWidth * 0.5 + waveOffset), startY + inwardDy * (beachWidth * 0.5 + waveOffset));
    ctx.closePath();
    ctx.fill();
    
    // Water edge highlight
    ctx.strokeStyle = 'rgba(200, 230, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
  };
  
  // North edge
  if (north) {
    drawBeachEdge(screenX, cy, cx, screenY, 0.707, 0.707);
  }
  
  // East edge
  if (east) {
    drawBeachEdge(cx, screenY, screenX + w, cy, -0.707, 0.707);
  }
  
  // South edge
  if (south) {
    drawBeachEdge(screenX + w, cy, cx, screenY + h, -0.707, -0.707);
  }
  
  // West edge
  if (west) {
    drawBeachEdge(cx, screenY + h, screenX, cy, 0.707, -0.707);
  }
  
  // Add shell/debris details
  initNoise();
  const shellCount = 2;
  for (let i = 0; i < shellCount; i++) {
    const seed = seededRandom(gridX, gridY, i + 200);
    if (seed < 0.3) {
      const sx = cx + (seededRandom(gridX, gridY, i + 201) - 0.5) * w * 0.3;
      const sy = cy + (seededRandom(gridY, gridX, i + 201) - 0.5) * h * 0.3;
      
      ctx.fillStyle = BEACH_PALETTE.shells;
      ctx.beginPath();
      ctx.ellipse(sx, sy, 1.5, 1, seed * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ============================================================================
// ENHANCED FOREST RENDERING
// ============================================================================

/**
 * Draw an enhanced forest tile with layered trees and wind animation
 */
export function drawEnhancedForest(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  forestDensity: number, // 0-1
  zoom: number,
  animTime: number
): void {
  if (forestDensity <= 0) return;
  
  initNoise();
  
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = screenX + w / 2;
  const cy = screenY + h / 2;
  
  // Number of trees based on density
  const treeCount = Math.floor(3 + forestDensity * 4);
  
  // Wind effect
  const windStrength = windNoise(animTime * 0.5, 0) * 3;
  
  // Sort trees by Y for proper overlap
  const trees: Array<{ x: number; y: number; scale: number; variant: number }> = [];
  
  for (let i = 0; i < treeCount; i++) {
    const seed1 = seededRandom(gridX, gridY, i * 3);
    const seed2 = seededRandom(gridY, gridX, i * 3 + 1);
    const seed3 = seededRandom(gridX + gridY, gridX - gridY, i * 3 + 2);
    
    // Position within tile (isometric space)
    const u = seed1 * 0.8 + 0.1;
    const v = seed2 * 0.8 + 0.1;
    
    trees.push({
      x: screenX + (u + v) * w / 2,
      y: screenY + (u - v + 1) * h / 2 - 5, // Offset up slightly
      scale: 0.6 + seed3 * 0.5,
      variant: Math.floor(seed1 * 3),
    });
  }
  
  // Sort by Y (back to front)
  trees.sort((a, b) => a.y - b.y);
  
  // Draw ground shadow first
  ctx.fillStyle = 'rgba(42, 58, 26, 0.4)';
  for (const tree of trees) {
    ctx.beginPath();
    ctx.ellipse(tree.x, tree.y + 8 * tree.scale, 8 * tree.scale, 3 * tree.scale, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Draw trees
  for (const tree of trees) {
    const windSway = windStrength * Math.sin(animTime * 2 + tree.x * 0.1) * tree.scale;
    drawTree(ctx, tree.x, tree.y, tree.scale, tree.variant, windSway, zoom);
  }
}

/**
 * Draw a single tree
 */
function drawTree(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  variant: number,
  windSway: number,
  zoom: number
): void {
  const trunkHeight = 8 * scale;
  const canopyRadius = 10 * scale;
  
  // Trunk
  ctx.fillStyle = FOREST_PALETTE.trunk;
  ctx.beginPath();
  ctx.moveTo(x - 2 * scale, y);
  ctx.lineTo(x + 2 * scale, y);
  ctx.lineTo(x + 1.5 * scale + windSway * 0.3, y - trunkHeight);
  ctx.lineTo(x - 1.5 * scale + windSway * 0.3, y - trunkHeight);
  ctx.closePath();
  ctx.fill();
  
  // Trunk shadow side
  ctx.fillStyle = FOREST_PALETTE.trunkDark;
  ctx.beginPath();
  ctx.moveTo(x - 2 * scale, y);
  ctx.lineTo(x, y);
  ctx.lineTo(x + windSway * 0.3, y - trunkHeight);
  ctx.lineTo(x - 1.5 * scale + windSway * 0.3, y - trunkHeight);
  ctx.closePath();
  ctx.fill();
  
  // Canopy layers (multiple overlapping shapes for fullness)
  const canopyY = y - trunkHeight;
  
  // Back canopy (darker)
  ctx.fillStyle = FOREST_PALETTE.canopy;
  if (variant === 0) {
    // Conifer (triangular)
    ctx.beginPath();
    ctx.moveTo(x + windSway, canopyY - canopyRadius * 1.5);
    ctx.lineTo(x - canopyRadius * 0.8 + windSway * 0.5, canopyY);
    ctx.lineTo(x + canopyRadius * 0.8 + windSway * 0.5, canopyY);
    ctx.closePath();
    ctx.fill();
  } else {
    // Deciduous (rounded)
    ctx.beginPath();
    ctx.ellipse(x + windSway * 0.7, canopyY - canopyRadius * 0.5, canopyRadius, canopyRadius * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Front canopy (lighter, sunlit)
  ctx.fillStyle = FOREST_PALETTE.canopyLight;
  if (variant === 0) {
    ctx.beginPath();
    ctx.moveTo(x + windSway + canopyRadius * 0.2, canopyY - canopyRadius * 1.3);
    ctx.lineTo(x + canopyRadius * 0.3 + windSway * 0.5, canopyY);
    ctx.lineTo(x + canopyRadius * 0.7 + windSway * 0.5, canopyY - canopyRadius * 0.3);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.ellipse(x + canopyRadius * 0.3 + windSway * 0.7, canopyY - canopyRadius * 0.3, canopyRadius * 0.5, canopyRadius * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ============================================================================
// ENHANCED MOUNTAIN RENDERING
// ============================================================================

/**
 * Draw an enhanced mountain/metal deposit tile
 */
export function drawEnhancedMountain(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  hasOre: boolean,
  zoom: number,
  animTime: number
): void {
  initNoise();
  
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = screenX + w / 2;
  const cy = screenY + h / 2;
  
  // Mountain base (rocky ground)
  const baseNoise = terrainNoise(gridX * 0.5, gridY * 0.5);
  const baseColor = blendColors(MOUNTAIN_PALETTE.rock, MOUNTAIN_PALETTE.rockDark, 0.5 + baseNoise * 0.3);
  
  // Draw rocky base tile
  ctx.fillStyle = baseColor;
  ctx.beginPath();
  ctx.moveTo(cx, screenY);
  ctx.lineTo(screenX + w, cy);
  ctx.lineTo(cx, screenY + h);
  ctx.lineTo(screenX, cy);
  ctx.closePath();
  ctx.fill();
  
  // Draw mountain peak(s)
  const peakCount = 1 + Math.floor(seededRandom(gridX, gridY, 300) * 2);
  
  for (let i = 0; i < peakCount; i++) {
    const seed = seededRandom(gridX, gridY, 301 + i);
    const peakX = cx + (seed - 0.5) * w * 0.4;
    const peakBaseY = cy + 2;
    const peakHeight = 20 + seed * 15;
    const peakWidth = 15 + seed * 10;
    
    // Lit face (right)
    ctx.fillStyle = MOUNTAIN_PALETTE.rockLight;
    ctx.beginPath();
    ctx.moveTo(peakX, peakBaseY - peakHeight);
    ctx.lineTo(peakX + peakWidth * 0.5, peakBaseY);
    ctx.lineTo(peakX, peakBaseY);
    ctx.closePath();
    ctx.fill();
    
    // Shadow face (left)
    ctx.fillStyle = MOUNTAIN_PALETTE.rockDark;
    ctx.beginPath();
    ctx.moveTo(peakX, peakBaseY - peakHeight);
    ctx.lineTo(peakX - peakWidth * 0.5, peakBaseY);
    ctx.lineTo(peakX, peakBaseY);
    ctx.closePath();
    ctx.fill();
    
    // Snow cap at top
    if (peakHeight > 25) {
      const snowLine = peakHeight * 0.3;
      ctx.fillStyle = MOUNTAIN_PALETTE.snow;
      ctx.beginPath();
      ctx.moveTo(peakX, peakBaseY - peakHeight);
      ctx.lineTo(peakX + peakWidth * 0.2, peakBaseY - peakHeight + snowLine);
      ctx.lineTo(peakX - peakWidth * 0.15, peakBaseY - peakHeight + snowLine * 0.8);
      ctx.closePath();
      ctx.fill();
    }
  }
  
  // Ore deposit glints
  if (hasOre && zoom >= 0.6) {
    const glintPhase = (animTime * 3) % (Math.PI * 2);
    const glintIntensity = Math.sin(glintPhase) * 0.5 + 0.5;
    
    ctx.fillStyle = `rgba(212, 180, 74, ${0.3 + glintIntensity * 0.5})`;
    
    for (let i = 0; i < 4; i++) {
      const seed = seededRandom(gridX, gridY, 400 + i);
      const seed2 = seededRandom(gridY, gridX, 400 + i);
      const gx = cx + (seed - 0.5) * w * 0.5;
      const gy = cy + (seed2 - 0.5) * h * 0.3;
      const gSize = 2 + seed * 2;
      
      ctx.beginPath();
      ctx.arc(gx, gy, gSize, 0, Math.PI * 2);
      ctx.fill();
      
      // Sparkle effect
      if (glintIntensity > 0.7) {
        ctx.strokeStyle = `rgba(255, 255, 200, ${(glintIntensity - 0.7) * 3})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(gx - 3, gy);
        ctx.lineTo(gx + 3, gy);
        ctx.moveTo(gx, gy - 3);
        ctx.lineTo(gx, gy + 3);
        ctx.stroke();
      }
    }
  }
}

// ============================================================================
// ENHANCED SKY / ATMOSPHERE
// ============================================================================

/**
 * Draw an enhanced sky background with gradient and clouds
 */
export function drawEnhancedSky(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  timeOfDay: 'day' | 'dusk' | 'night' | 'dawn' = 'day',
  animTime: number = 0
): void {
  const palette = SKY_PALETTES[timeOfDay];
  
  // Main sky gradient
  const skyGradient = ctx.createLinearGradient(0, 0, 0, height);
  skyGradient.addColorStop(0, palette.zenith);
  skyGradient.addColorStop(0.6, palette.horizon);
  skyGradient.addColorStop(1, adjustBrightness(palette.horizon, 20));
  
  ctx.fillStyle = skyGradient;
  ctx.fillRect(0, 0, width, height);
  
  // Add subtle clouds for day/dawn/dusk
  if (timeOfDay !== 'night') {
    initNoise();
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    
    for (let i = 0; i < 5; i++) {
      const cloudX = (i * 200 + animTime * 10) % (width + 100) - 50;
      const cloudY = 30 + i * 40;
      
      // Cloud puffs
      for (let j = 0; j < 4; j++) {
        const puffX = cloudX + j * 25;
        const puffY = cloudY + Math.sin(j + animTime * 0.5) * 5;
        const puffSize = 20 + Math.sin(j * 1.5) * 10;
        
        ctx.beginPath();
        ctx.arc(puffX, puffY, puffSize, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  
  // Stars for night
  if (timeOfDay === 'night') {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    for (let i = 0; i < 50; i++) {
      const sx = seededRandom(i, 1000, 0) * width;
      const sy = seededRandom(1000, i, 0) * height * 0.5;
      const twinkle = Math.sin(animTime * 3 + i) * 0.5 + 0.5;
      
      ctx.globalAlpha = 0.3 + twinkle * 0.7;
      ctx.beginPath();
      ctx.arc(sx, sy, 1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

// ============================================================================
// PARTICLE EFFECTS
// ============================================================================

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

// Particle pool for performance
const particlePools: Map<string, Particle[]> = new Map();

/**
 * Draw smoke particles from a building
 */
export function drawSmokeParticles(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  animTime: number,
  intensity: number = 1
): void {
  const particleCount = Math.floor(3 * intensity);
  
  for (let i = 0; i < particleCount; i++) {
    const phase = (animTime * 2 + i * 1.5) % 3;
    const alpha = Math.max(0, 1 - phase / 3);
    const size = 3 + phase * 4;
    const px = x + Math.sin(animTime + i) * 3;
    const py = y - phase * 15;
    
    ctx.fillStyle = `rgba(120, 120, 120, ${alpha * 0.4})`;
    ctx.beginPath();
    ctx.arc(px, py, size, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Draw dust/dirt particles
 */
export function drawDustCloud(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  animTime: number,
  color: string = '#8a7a6a'
): void {
  const rgb = hexToRgb(color);
  
  for (let i = 0; i < 5; i++) {
    const phase = (animTime * 3 + i * 0.8) % 2;
    const alpha = Math.max(0, 1 - phase);
    const size = 2 + phase * 3;
    const angle = (i / 5) * Math.PI * 2;
    const px = x + Math.cos(angle) * phase * 10;
    const py = y + Math.sin(angle) * phase * 5 - phase * 3;
    
    ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha * 0.5})`;
    ctx.beginPath();
    ctx.arc(px, py, size, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Draw splash effect for units entering water
 */
export function drawSplashEffect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  animTime: number
): void {
  const splashPhase = (animTime * 4) % 1;
  if (splashPhase > 0.5) return;
  
  const alpha = 1 - splashPhase * 2;
  const size = 5 + splashPhase * 15;
  
  ctx.strokeStyle = `rgba(200, 230, 255, ${alpha})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.stroke();
  
  // Droplets
  ctx.fillStyle = `rgba(200, 230, 255, ${alpha * 0.7})`;
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const dist = size + splashPhase * 5;
    const dropX = x + Math.cos(angle) * dist;
    const dropY = y + Math.sin(angle) * dist * 0.5 - splashPhase * 10;
    
    ctx.beginPath();
    ctx.arc(dropX, dropY, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ============================================================================
// UNIT SHADOWS
// ============================================================================

/**
 * Draw a unit shadow
 */
export function drawUnitShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  isFlying: boolean = false
): void {
  const shadowOffset = isFlying ? 10 : 2;
  const shadowAlpha = isFlying ? 0.15 : 0.25;
  
  ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha})`;
  ctx.beginPath();
  ctx.ellipse(x, y + shadowOffset, width, height * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
}

// ============================================================================
// TERRITORY OVERLAY
// ============================================================================

/**
 * Draw territory ownership overlay with player color
 */
export function drawTerritoryOverlay(
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
  
  const rgb = hexToRgb(playerColor);
  
  ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${intensity})`;
  ctx.beginPath();
  ctx.moveTo(cx, screenY);
  ctx.lineTo(screenX + w, cy);
  ctx.lineTo(cx, screenY + h);
  ctx.lineTo(screenX, cy);
  ctx.closePath();
  ctx.fill();
  
  // Border
  ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${intensity * 2})`;
  ctx.lineWidth = 1;
  ctx.stroke();
}
