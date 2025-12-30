/**
 * Rise of Nations - Enhanced Graphics System
 * 
 * Provides realistic, polished rendering for terrain, water, beaches,
 * forests, mountains, and atmospheric effects.
 * 
 * Uses simplex noise for procedural variation and natural-looking textures.
 */

import { createNoise2D, createNoise3D } from 'simplex-noise';
import { TILE_WIDTH, TILE_HEIGHT } from '@/components/game/shared';

// ============================================================================
// NOISE GENERATORS (cached for performance)
// ============================================================================

// Create seeded noise functions for deterministic terrain
const terrainNoise2D = createNoise2D(() => 0.12345);
const grassDetailNoise = createNoise2D(() => 0.54321);
const waterNoise3D = createNoise3D(() => 0.98765);
const foamNoise2D = createNoise2D(() => 0.67890);
const treeNoise2D = createNoise2D(() => 0.13579);
const windNoise2D = createNoise2D(() => 0.24680);

// ============================================================================
// COLOR PALETTES - Natural, muted tones
// ============================================================================

// Grass/terrain colors - earthy greens and browns, not cartoon green
const TERRAIN_COLORS = {
  // Base grass - muted olive/sage tones
  grassLight: '#6b7c52',
  grassMid: '#5a6b45',
  grassDark: '#4a5a38',
  grassShadow: '#3d4b2f',
  
  // Dirt/earth patches
  dirtLight: '#8b7355',
  dirtMid: '#7a6248',
  dirtDark: '#6b5340',
  
  // Dry grass patches
  dryGrass: '#a89860',
  dryGrassLight: '#c4b478',
  
  // Path/worn areas
  pathLight: '#9a8a72',
  pathDark: '#7a6a52',
};

// Water colors - deep ocean to shallow coast
const WATER_COLORS = {
  // Deep water
  deepBlue: '#1a4a6e',
  deepMid: '#1e5580',
  deepDark: '#143d5a',
  
  // Shallow/coastal water
  shallowBlue: '#3a7ca5',
  shallowLight: '#4a9cc5',
  shallowTurquoise: '#45a0a8',
  
  // Wave/foam
  foam: '#e8f4f8',
  foamShadow: '#b8d4e0',
  waveCrest: '#ffffff',
  waveBase: '#6ab0cc',
  
  // Reflection hints
  skyReflection: 'rgba(135, 206, 235, 0.15)',
};

// Beach/sand colors
const BEACH_COLORS = {
  sandDry: '#e8d8b8',
  sandMid: '#d4c4a8',
  sandWet: '#a89878',
  sandDark: '#8a7a68',
  sandHighlight: '#f5ece0',
};

// Forest colors
const FOREST_COLORS = {
  // Tree foliage - varied greens
  foliageDark: '#2d4a2a',
  foliageMid: '#3d5a38',
  foliageLight: '#4d6a45',
  foliageHighlight: '#5d7a52',
  
  // Autumn/varied trees
  foliageOlive: '#6b7a48',
  foliageTeal: '#3a5a4a',
  
  // Tree trunks
  trunkDark: '#3d2a1a',
  trunkMid: '#5a4030',
  trunkLight: '#7a6050',
  
  // Ground under trees
  forestFloor: '#3a4a2a',
  forestShadow: '#2a3a20',
};

// Mountain colors
const MOUNTAIN_COLORS = {
  // Rock faces
  rockLight: '#9a9a9a',
  rockMid: '#7a7a7a',
  rockDark: '#5a5a5a',
  rockShadow: '#4a4a4a',
  
  // Warm rock tones
  rockWarm: '#8a7a6a',
  rockCool: '#6a7a8a',
  
  // Snow
  snowBright: '#ffffff',
  snowMid: '#e8f0f5',
  snowShadow: '#c8d8e5',
  
  // Ore/metal
  oreDark: '#2a2a3a',
  oreGlint: '#8a8a9a',
};

// ============================================================================
// CACHED PATTERN GENERATION
// ============================================================================

interface CachedPattern {
  canvas: OffscreenCanvas | HTMLCanvasElement;
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
}

const patternCache = new Map<string, CachedPattern>();

function getOrCreatePattern(key: string, width: number, height: number): CachedPattern {
  if (patternCache.has(key)) {
    return patternCache.get(key)!;
  }
  
  // Use OffscreenCanvas if available, otherwise regular canvas
  const canvas = typeof OffscreenCanvas !== 'undefined' 
    ? new OffscreenCanvas(width, height)
    : document.createElement('canvas');
  
  if (!(canvas instanceof OffscreenCanvas)) {
    canvas.width = width;
    canvas.height = height;
  }
  
  const ctx = canvas.getContext('2d')!;
  const pattern: CachedPattern = { canvas, ctx };
  patternCache.set(key, pattern);
  return pattern;
}

// ============================================================================
// TERRAIN RENDERING - Realistic grass/dirt with procedural variation
// ============================================================================

/**
 * Draw a realistic grass tile with procedural texture and natural variation
 */
export function drawRealisticGrassTile(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  zoom: number = 1,
  options: {
    territory?: string | null;
    territoryColor?: string;
    highlight?: boolean;
    forestDensity?: number;
  } = {}
): void {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = screenX + w / 2;
  const cy = screenY + h / 2;
  
  // Sample noise for variation
  const baseNoise = terrainNoise2D(gridX * 0.15, gridY * 0.15);
  const detailNoise = grassDetailNoise(gridX * 0.4, gridY * 0.4);
  const dirtNoise = terrainNoise2D(gridX * 0.08 + 100, gridY * 0.08 + 100);
  
  // Determine base color based on noise
  const isDirty = dirtNoise > 0.6;
  const isDry = baseNoise > 0.5 && detailNoise > 0.3;
  
  // Create gradient for depth
  const gradient = ctx.createLinearGradient(
    screenX, screenY,
    screenX + w, screenY + h
  );
  
  if (isDirty) {
    // Dirt patch
    gradient.addColorStop(0, TERRAIN_COLORS.dirtLight);
    gradient.addColorStop(0.5, TERRAIN_COLORS.dirtMid);
    gradient.addColorStop(1, TERRAIN_COLORS.dirtDark);
  } else if (isDry) {
    // Dry grass
    gradient.addColorStop(0, TERRAIN_COLORS.dryGrassLight);
    gradient.addColorStop(0.5, TERRAIN_COLORS.dryGrass);
    gradient.addColorStop(1, TERRAIN_COLORS.grassDark);
  } else {
    // Normal grass - use noise to vary the exact shade
    const colorMix = (baseNoise + 1) / 2;
    gradient.addColorStop(0, lerpColor(TERRAIN_COLORS.grassLight, TERRAIN_COLORS.grassMid, colorMix));
    gradient.addColorStop(0.5, TERRAIN_COLORS.grassMid);
    gradient.addColorStop(1, lerpColor(TERRAIN_COLORS.grassDark, TERRAIN_COLORS.grassShadow, colorMix));
  }
  
  // Draw base tile
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(cx, screenY);
  ctx.lineTo(screenX + w, cy);
  ctx.lineTo(cx, screenY + h);
  ctx.lineTo(screenX, cy);
  ctx.closePath();
  ctx.fill();
  
  // Add procedural detail (grass blades, texture) when zoomed in
  if (zoom >= 0.7) {
    drawGrassDetail(ctx, screenX, screenY, gridX, gridY, w, h, zoom);
  }
  
  // Add ambient occlusion at edges (subtle darkening)
  const aoGradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.6);
  aoGradient.addColorStop(0.7, 'rgba(0,0,0,0)');
  aoGradient.addColorStop(1, 'rgba(0,0,0,0.08)');
  ctx.fillStyle = aoGradient;
  ctx.beginPath();
  ctx.moveTo(cx, screenY);
  ctx.lineTo(screenX + w, cy);
  ctx.lineTo(cx, screenY + h);
  ctx.lineTo(screenX, cy);
  ctx.closePath();
  ctx.fill();
  
  // Territory overlay
  if (options.territory && options.territoryColor) {
    ctx.fillStyle = hexToRgba(options.territoryColor, 0.12);
    ctx.beginPath();
    ctx.moveTo(cx, screenY);
    ctx.lineTo(screenX + w, cy);
    ctx.lineTo(cx, screenY + h);
    ctx.lineTo(screenX, cy);
    ctx.closePath();
    ctx.fill();
  }
  
  // Grid lines (subtle)
  if (zoom >= 0.8) {
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(cx, screenY);
    ctx.lineTo(screenX + w, cy);
    ctx.lineTo(cx, screenY + h);
    ctx.lineTo(screenX, cy);
    ctx.closePath();
    ctx.stroke();
  }
}

/**
 * Draw grass blade details and texture
 */
function drawGrassDetail(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  w: number,
  h: number,
  zoom: number
): void {
  // Seed for deterministic placement
  const seed = gridX * 1000 + gridY;
  
  // Draw small grass tuft shapes
  const numTufts = Math.floor(4 + (seed % 4));
  
  ctx.save();
  ctx.globalAlpha = 0.4;
  
  for (let i = 0; i < numTufts; i++) {
    const tSeed = seed * 7 + i * 13;
    
    // Position within tile (using noise for natural scatter)
    const nx = grassDetailNoise((gridX + i * 0.3) * 0.5, gridY * 0.5);
    const ny = grassDetailNoise(gridX * 0.5, (gridY + i * 0.3) * 0.5);
    
    const tx = screenX + w * 0.25 + (nx + 1) / 2 * w * 0.5;
    const ty = screenY + h * 0.25 + (ny + 1) / 2 * h * 0.5;
    
    // Small grass tuft
    const tuftSize = 2 + (tSeed % 3);
    ctx.fillStyle = tSeed % 3 === 0 ? TERRAIN_COLORS.grassLight : TERRAIN_COLORS.grassDark;
    
    // Draw as small curved lines
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(tx, ty + tuftSize);
    ctx.quadraticCurveTo(tx - 1, ty, tx - 1, ty - tuftSize);
    ctx.moveTo(tx, ty + tuftSize);
    ctx.quadraticCurveTo(tx + 1, ty, tx + 1, ty - tuftSize);
    ctx.stroke();
  }
  
  ctx.restore();
}

// ============================================================================
// WATER RENDERING - Animated waves, depth, foam, reflections
// ============================================================================

/**
 * Draw realistic animated water tile with depth and wave effects
 */
export function drawRealisticWaterTile(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  animTime: number,
  adjacency: {
    north: boolean;
    east: boolean;
    south: boolean;
    west: boolean;
  },
  options: {
    isDeep?: boolean;
    hasFishingSpot?: boolean;
  } = {}
): void {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = screenX + w / 2;
  const cy = screenY + h / 2;
  
  // Calculate depth based on distance from shore
  const shoreCount = [adjacency.north, adjacency.east, adjacency.south, adjacency.west]
    .filter(v => !v).length;
  const isShallow = shoreCount > 0;
  const depth = isShallow ? 0.3 + shoreCount * 0.15 : 1.0;
  
  // Animated wave displacement
  const wavePhase = animTime * 1.2 + gridX * 0.3 + gridY * 0.2;
  const wave1 = Math.sin(wavePhase) * 0.5;
  const wave2 = Math.cos(wavePhase * 0.7 + 1.5) * 0.3;
  const waveOffset = wave1 + wave2;
  
  // Base water color (depth-based)
  const baseColor = isShallow 
    ? lerpColor(WATER_COLORS.shallowLight, WATER_COLORS.shallowBlue, depth)
    : lerpColor(WATER_COLORS.deepMid, WATER_COLORS.deepBlue, 0.5 + waveOffset * 0.1);
  
  // Create gradient for depth effect
  const gradient = ctx.createLinearGradient(
    screenX, screenY,
    screenX + w, screenY + h
  );
  
  if (isShallow) {
    // Shallow water - turquoise to blue gradient
    gradient.addColorStop(0, WATER_COLORS.shallowTurquoise);
    gradient.addColorStop(0.5, WATER_COLORS.shallowBlue);
    gradient.addColorStop(1, WATER_COLORS.shallowLight);
  } else {
    // Deep water - darker blues
    gradient.addColorStop(0, WATER_COLORS.deepMid);
    gradient.addColorStop(0.5, WATER_COLORS.deepBlue);
    gradient.addColorStop(1, WATER_COLORS.deepDark);
  }
  
  // Draw base water
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(cx, screenY);
  ctx.lineTo(screenX + w, cy);
  ctx.lineTo(cx, screenY + h);
  ctx.lineTo(screenX, cy);
  ctx.closePath();
  ctx.fill();
  
  // Add wave pattern overlay
  drawWavePattern(ctx, screenX, screenY, gridX, gridY, w, h, animTime, depth);
  
  // Add subtle reflection
  const reflectionGradient = ctx.createLinearGradient(
    screenX, screenY,
    screenX + w * 0.3, screenY + h * 0.3
  );
  reflectionGradient.addColorStop(0, 'rgba(255,255,255,0.12)');
  reflectionGradient.addColorStop(0.5, 'rgba(255,255,255,0.05)');
  reflectionGradient.addColorStop(1, 'rgba(255,255,255,0)');
  
  ctx.fillStyle = reflectionGradient;
  ctx.beginPath();
  ctx.moveTo(cx, screenY);
  ctx.lineTo(screenX + w, cy);
  ctx.lineTo(cx, screenY + h);
  ctx.lineTo(screenX, cy);
  ctx.closePath();
  ctx.fill();
  
  // Add foam at edges (shore)
  if (shoreCount > 0) {
    drawShorelineFoam(ctx, screenX, screenY, gridX, gridY, w, h, animTime, adjacency);
  }
  
  // Fishing spot indicator
  if (options.hasFishingSpot) {
    drawFishingSpotIndicator(ctx, cx, cy, animTime, gridX, gridY);
  }
}

/**
 * Draw animated wave pattern
 */
function drawWavePattern(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  w: number,
  h: number,
  animTime: number,
  depth: number
): void {
  ctx.save();
  
  // Clip to tile shape
  const cx = screenX + w / 2;
  const cy = screenY + h / 2;
  ctx.beginPath();
  ctx.moveTo(cx, screenY);
  ctx.lineTo(screenX + w, cy);
  ctx.lineTo(cx, screenY + h);
  ctx.lineTo(screenX, cy);
  ctx.closePath();
  ctx.clip();
  
  // Draw wave lines
  const waveIntensity = 0.15 * depth;
  ctx.strokeStyle = `rgba(255,255,255,${waveIntensity})`;
  ctx.lineWidth = 0.8;
  
  const numWaves = 3;
  for (let i = 0; i < numWaves; i++) {
    const phase = animTime * 1.5 + i * 0.8 + gridX * 0.2;
    const yOffset = (i / numWaves) * h * 0.6 + h * 0.2;
    
    ctx.beginPath();
    for (let x = 0; x <= w; x += 4) {
      const waveY = Math.sin(phase + x * 0.1) * 2;
      const px = screenX + x;
      const py = screenY + yOffset + waveY;
      
      if (x === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.stroke();
  }
  
  ctx.restore();
}

/**
 * Draw foam at shoreline edges
 */
function drawShorelineFoam(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  w: number,
  h: number,
  animTime: number,
  adjacency: { north: boolean; east: boolean; south: boolean; west: boolean }
): void {
  const cx = screenX + w / 2;
  const cy = screenY + h / 2;
  
  ctx.save();
  
  // Clip to tile
  ctx.beginPath();
  ctx.moveTo(cx, screenY);
  ctx.lineTo(screenX + w, cy);
  ctx.lineTo(cx, screenY + h);
  ctx.lineTo(screenX, cy);
  ctx.closePath();
  ctx.clip();
  
  const foamPhase = animTime * 2 + gridX * 0.5 + gridY * 0.3;
  const foamPulse = (Math.sin(foamPhase) + 1) / 2;
  
  // Draw foam along non-water edges
  const edgeWidth = 8 + foamPulse * 4;
  
  if (!adjacency.north) {
    // Foam on north edge (top-left)
    const foamGradient = ctx.createLinearGradient(
      screenX, cy, cx, screenY
    );
    foamGradient.addColorStop(0, 'rgba(255,255,255,0)');
    foamGradient.addColorStop(0.5, `rgba(255,255,255,${0.3 + foamPulse * 0.2})`);
    foamGradient.addColorStop(1, 'rgba(255,255,255,0.1)');
    
    ctx.fillStyle = foamGradient;
    ctx.beginPath();
    ctx.moveTo(screenX, cy);
    ctx.lineTo(cx, screenY);
    ctx.lineTo(cx - edgeWidth, screenY + edgeWidth);
    ctx.lineTo(screenX, cy + edgeWidth);
    ctx.closePath();
    ctx.fill();
  }
  
  if (!adjacency.east) {
    // Foam on east edge (top-right)
    ctx.fillStyle = `rgba(255,255,255,${0.25 + foamPulse * 0.15})`;
    ctx.beginPath();
    ctx.moveTo(cx, screenY);
    ctx.lineTo(screenX + w, cy);
    ctx.lineTo(screenX + w - edgeWidth, cy);
    ctx.lineTo(cx, screenY + edgeWidth);
    ctx.closePath();
    ctx.fill();
  }
  
  if (!adjacency.south) {
    // Foam on south edge (bottom-right)
    ctx.fillStyle = `rgba(255,255,255,${0.2 + foamPulse * 0.1})`;
    ctx.beginPath();
    ctx.moveTo(screenX + w, cy);
    ctx.lineTo(cx, screenY + h);
    ctx.lineTo(cx + edgeWidth, screenY + h - edgeWidth);
    ctx.lineTo(screenX + w, cy - edgeWidth);
    ctx.closePath();
    ctx.fill();
  }
  
  if (!adjacency.west) {
    // Foam on west edge (bottom-left)
    ctx.fillStyle = `rgba(255,255,255,${0.2 + foamPulse * 0.1})`;
    ctx.beginPath();
    ctx.moveTo(cx, screenY + h);
    ctx.lineTo(screenX, cy);
    ctx.lineTo(screenX + edgeWidth, cy);
    ctx.lineTo(cx, screenY + h - edgeWidth);
    ctx.closePath();
    ctx.fill();
  }
  
  ctx.restore();
}

/**
 * Draw fishing spot indicator with ripples
 */
function drawFishingSpotIndicator(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  animTime: number,
  gridX: number,
  gridY: number
): void {
  ctx.save();
  ctx.globalAlpha = 0.6;
  
  const phase = animTime * 2 + gridX * 0.3 + gridY * 0.5;
  const ripplePhase = phase % (Math.PI * 2);
  
  // Animated ripples
  ctx.strokeStyle = WATER_COLORS.foam;
  ctx.lineWidth = 1;
  
  for (let i = 0; i < 2; i++) {
    const rPhase = (ripplePhase + i * Math.PI) % (Math.PI * 2);
    const rSize = 3 + rPhase * 4;
    const rAlpha = 1 - rPhase / (Math.PI * 2);
    
    ctx.globalAlpha = rAlpha * 0.4;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rSize * 1.5, rSize * 0.8, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  
  // Small fish silhouette
  const fishX = cx + Math.sin(phase * 1.5) * 5;
  const fishY = cy + Math.cos(phase) * 2;
  
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = '#4a6080';
  ctx.beginPath();
  ctx.ellipse(fishX, fishY, 4, 2, Math.sin(phase) * 0.2, 0, Math.PI * 2);
  ctx.fill();
  
  // Tail
  ctx.beginPath();
  ctx.moveTo(fishX - 4, fishY);
  ctx.lineTo(fishX - 7, fishY - 2);
  ctx.lineTo(fishX - 7, fishY + 2);
  ctx.closePath();
  ctx.fill();
  
  ctx.restore();
}

// ============================================================================
// BEACH RENDERING - Wet/dry gradients, sand texture
// ============================================================================

/**
 * Draw beach/sand overlay on water tile adjacent to land
 * This renders semi-transparent beach where water meets land
 */
export function drawBeachTile(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  animTime: number,
  adjacentLand: { north?: boolean; east?: boolean; south?: boolean; west?: boolean }
): void {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = screenX + w / 2;
  const cy = screenY + h / 2;
  
  // Draw beach for each adjacent land direction
  const directions = ['north', 'east', 'south', 'west'] as const;
  
  for (const dir of directions) {
    if (!adjacentLand[dir]) continue;
    
    ctx.save();
    
    // Create a clipping region for this edge of the tile
    ctx.beginPath();
    switch (dir) {
      case 'north':
        ctx.moveTo(cx, screenY);
        ctx.lineTo(screenX, cy);
        ctx.lineTo(cx, cy);
        ctx.closePath();
        break;
      case 'east':
        ctx.moveTo(cx, screenY);
        ctx.lineTo(screenX + w, cy);
        ctx.lineTo(cx, cy);
        ctx.closePath();
        break;
      case 'south':
        ctx.moveTo(screenX + w, cy);
        ctx.lineTo(cx, screenY + h);
        ctx.lineTo(cx, cy);
        ctx.closePath();
        break;
      case 'west':
        ctx.moveTo(cx, screenY + h);
        ctx.lineTo(screenX, cy);
        ctx.lineTo(cx, cy);
        ctx.closePath();
        break;
    }
    ctx.clip();
    
    // Create wet-to-dry gradient from land toward water (center)
    let gradient: CanvasGradient;
    switch (dir) {
      case 'north':
        gradient = ctx.createLinearGradient(screenX, cy, cx, screenY);
        break;
      case 'east':
        gradient = ctx.createLinearGradient(cx, screenY, screenX + w, cy);
        break;
      case 'south':
        gradient = ctx.createLinearGradient(screenX + w, cy, cx, screenY + h);
        break;
      case 'west':
      default:
        gradient = ctx.createLinearGradient(cx, screenY + h, screenX, cy);
        break;
    }
    
    // Beach colors from wet (near water) to dry (near land)
    gradient.addColorStop(0, BEACH_COLORS.sandWet);
    gradient.addColorStop(0.3, BEACH_COLORS.sandMid);
    gradient.addColorStop(0.6, BEACH_COLORS.sandDry);
    gradient.addColorStop(1, BEACH_COLORS.sandHighlight);
    
    // Draw beach section
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(cx, screenY);
    ctx.lineTo(screenX + w, cy);
    ctx.lineTo(cx, screenY + h);
    ctx.lineTo(screenX, cy);
    ctx.closePath();
    ctx.fill();
    
    // Add sand texture in this section
    const seed = gridX * 31 + gridY * 17;
    for (let i = 0; i < 8; i++) {
      const dotSeed = seed * 7 + i * 13;
      const dx = (dotSeed % 100) / 100 * w * 0.4;
      const dy = (dotSeed * 3 % 100) / 100 * h * 0.4;
      
      let dotX: number, dotY: number;
      switch (dir) {
        case 'north':
          dotX = screenX + dx + w * 0.1;
          dotY = screenY + h * 0.1 + dy;
          break;
        case 'east':
          dotX = screenX + w * 0.5 + dx;
          dotY = screenY + dy + h * 0.1;
          break;
        case 'south':
          dotX = screenX + w * 0.5 + dx;
          dotY = screenY + h * 0.5 + dy;
          break;
        case 'west':
        default:
          dotX = screenX + dx + w * 0.1;
          dotY = screenY + h * 0.5 + dy;
          break;
      }
      
      ctx.fillStyle = BEACH_COLORS.sandDark + '40';
      ctx.beginPath();
      ctx.arc(dotX, dotY, 0.5 + (dotSeed % 2) * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Add animated foam line at water edge
    const foamPhase = animTime * 2 + gridX * 0.3 + gridY * 0.2;
    const foamOffset = Math.sin(foamPhase) * 2;
    const foamAlpha = 0.4 + Math.sin(foamPhase) * 0.2;
    
    ctx.strokeStyle = `rgba(255, 255, 255, ${foamAlpha})`;
    ctx.lineWidth = 2 + Math.sin(foamPhase * 1.5);
    ctx.lineCap = 'round';
    
    ctx.beginPath();
    switch (dir) {
      case 'north':
        ctx.moveTo(screenX + w * 0.15 + foamOffset, cy - h * 0.15);
        ctx.lineTo(cx - w * 0.15, screenY + h * 0.15 + foamOffset);
        break;
      case 'east':
        ctx.moveTo(cx + w * 0.15, screenY + h * 0.15 + foamOffset);
        ctx.lineTo(screenX + w - w * 0.15 + foamOffset, cy - h * 0.15);
        break;
      case 'south':
        ctx.moveTo(screenX + w - w * 0.15 + foamOffset, cy + h * 0.15);
        ctx.lineTo(cx + w * 0.15, screenY + h - h * 0.15 + foamOffset);
        break;
      case 'west':
        ctx.moveTo(cx - w * 0.15, screenY + h - h * 0.15 + foamOffset);
        ctx.lineTo(screenX + w * 0.15 + foamOffset, cy + h * 0.15);
        break;
    }
    ctx.stroke();
    
    ctx.restore();
  }
}

/**
 * Draw sand texture detail
 */
function drawSandTexture(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  w: number,
  h: number
): void {
  ctx.save();
  
  // Clip to tile
  const cx = screenX + w / 2;
  const cy = screenY + h / 2;
  ctx.beginPath();
  ctx.moveTo(cx, screenY);
  ctx.lineTo(screenX + w, cy);
  ctx.lineTo(cx, screenY + h);
  ctx.lineTo(screenX, cy);
  ctx.closePath();
  ctx.clip();
  
  // Draw subtle sand grains
  ctx.globalAlpha = 0.3;
  const seed = gridX * 1000 + gridY;
  
  for (let i = 0; i < 12; i++) {
    const gSeed = seed * 7 + i * 13;
    const gx = screenX + ((gSeed % 100) / 100) * w;
    const gy = screenY + ((gSeed * 3 % 100) / 100) * h;
    const gSize = 0.5 + (gSeed % 3) * 0.3;
    
    ctx.fillStyle = gSeed % 2 === 0 ? BEACH_COLORS.sandHighlight : BEACH_COLORS.sandDark;
    ctx.beginPath();
    ctx.arc(gx, gy, gSize, 0, Math.PI * 2);
    ctx.fill();
  }
  
  ctx.restore();
}

// ============================================================================
// FOREST RENDERING - Procedural trees with wind and shadows
// ============================================================================

/**
 * Draw forest tile with procedural trees
 */
export function drawForestTile(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  density: number,
  animTime: number,
  zoom: number = 1
): void {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = screenX + w / 2;
  const cy = screenY + h / 2;
  
  // Draw darker forest floor
  const floorGradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.5);
  floorGradient.addColorStop(0, FOREST_COLORS.forestFloor);
  floorGradient.addColorStop(1, FOREST_COLORS.forestShadow);
  
  ctx.fillStyle = floorGradient;
  ctx.beginPath();
  ctx.moveTo(cx, screenY);
  ctx.lineTo(screenX + w, cy);
  ctx.lineTo(cx, screenY + h);
  ctx.lineTo(screenX, cy);
  ctx.closePath();
  ctx.fill();
  
  // Number of trees based on density
  const normalizedDensity = Math.min(100, Math.max(0, density)) / 100;
  const numTrees = Math.floor(2 + normalizedDensity * 5);
  
  // Seed for deterministic tree placement
  const seed = gridX * 1000 + gridY;
  
  // Tree positions (back to front for proper layering)
  const trees: Array<{ x: number; y: number; size: number; type: number }> = [];
  
  for (let i = 0; i < numTrees; i++) {
    const tSeed = seed * 7 + i * 13;
    const nx = treeNoise2D((gridX + i * 0.2) * 0.5, gridY * 0.5);
    const ny = treeNoise2D(gridX * 0.5, (gridY + i * 0.2) * 0.5);
    
    trees.push({
      x: cx + (nx * 0.5) * w * 0.4,
      y: cy + (ny * 0.5) * h * 0.4 - 5,
      size: 0.7 + (tSeed % 4) * 0.15,
      type: tSeed % 3,
    });
  }
  
  // Sort by Y for proper depth
  trees.sort((a, b) => a.y - b.y);
  
  // Draw trees
  for (const tree of trees) {
    drawTree(ctx, tree.x, tree.y, tree.size, tree.type, animTime, zoom);
  }
}

/**
 * Draw a single procedural tree with wind animation
 */
function drawTree(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  type: number,
  animTime: number,
  zoom: number
): void {
  const scale = size * zoom;
  
  // Wind effect
  const windPhase = animTime * 1.5 + x * 0.05;
  const windSway = Math.sin(windPhase) * 1.5 * scale;
  
  ctx.save();
  ctx.translate(x, y);
  
  // Draw shadow first
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.ellipse(2, 8 * scale, 6 * scale, 2 * scale, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  
  // Trunk
  ctx.fillStyle = FOREST_COLORS.trunkMid;
  ctx.fillRect(-2 * scale, -2 * scale, 4 * scale, 12 * scale);
  
  // Tree type determines foliage shape
  if (type === 0) {
    // Conifer/pine tree - triangular shape
    drawConiferFoliage(ctx, windSway, scale);
  } else if (type === 1) {
    // Deciduous - round canopy
    drawDeciduousFoliage(ctx, windSway, scale);
  } else {
    // Oak-style - wide spreading
    drawOakFoliage(ctx, windSway, scale);
  }
  
  ctx.restore();
}

function drawConiferFoliage(ctx: CanvasRenderingContext2D, windSway: number, scale: number): void {
  // Draw multiple triangle layers
  const layers = 3;
  for (let i = 0; i < layers; i++) {
    const layerY = -5 * scale - i * 8 * scale;
    const layerWidth = (12 - i * 2) * scale;
    const layerHeight = 10 * scale;
    
    const xOffset = windSway * (0.5 + i * 0.3);
    
    // Shadow layer
    ctx.fillStyle = FOREST_COLORS.foliageDark;
    ctx.beginPath();
    ctx.moveTo(xOffset, layerY - layerHeight);
    ctx.lineTo(layerWidth / 2 + xOffset * 0.8, layerY);
    ctx.lineTo(-layerWidth / 2 + xOffset * 0.8, layerY);
    ctx.closePath();
    ctx.fill();
    
    // Highlight layer
    ctx.fillStyle = i === 0 ? FOREST_COLORS.foliageMid : FOREST_COLORS.foliageLight;
    ctx.beginPath();
    ctx.moveTo(xOffset - 1, layerY - layerHeight + 2);
    ctx.lineTo(layerWidth / 2 - 2 + xOffset * 0.7, layerY);
    ctx.lineTo(-layerWidth / 2 + 2 + xOffset * 0.7, layerY);
    ctx.closePath();
    ctx.fill();
  }
}

function drawDeciduousFoliage(ctx: CanvasRenderingContext2D, windSway: number, scale: number): void {
  // Round canopy with multiple blob shapes
  const centerY = -15 * scale;
  const canopyRadius = 10 * scale;
  
  // Back shadow
  ctx.fillStyle = FOREST_COLORS.foliageDark;
  ctx.beginPath();
  ctx.arc(windSway * 0.3, centerY, canopyRadius, 0, Math.PI * 2);
  ctx.fill();
  
  // Main canopy
  ctx.fillStyle = FOREST_COLORS.foliageMid;
  ctx.beginPath();
  ctx.arc(windSway * 0.5 - 2, centerY - 2, canopyRadius * 0.85, 0, Math.PI * 2);
  ctx.fill();
  
  // Highlight
  ctx.fillStyle = FOREST_COLORS.foliageLight;
  ctx.beginPath();
  ctx.arc(windSway * 0.6 - 4, centerY - 4, canopyRadius * 0.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawOakFoliage(ctx: CanvasRenderingContext2D, windSway: number, scale: number): void {
  // Wide spreading canopy with multiple lobes
  const centerY = -12 * scale;
  
  // Left lobe
  ctx.fillStyle = FOREST_COLORS.foliageDark;
  ctx.beginPath();
  ctx.ellipse(-6 * scale + windSway * 0.4, centerY, 8 * scale, 6 * scale, -0.2, 0, Math.PI * 2);
  ctx.fill();
  
  // Right lobe
  ctx.beginPath();
  ctx.ellipse(6 * scale + windSway * 0.4, centerY - 1, 7 * scale, 5.5 * scale, 0.2, 0, Math.PI * 2);
  ctx.fill();
  
  // Center
  ctx.fillStyle = FOREST_COLORS.foliageMid;
  ctx.beginPath();
  ctx.ellipse(windSway * 0.5, centerY - 3, 9 * scale, 7 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Highlight
  ctx.fillStyle = FOREST_COLORS.foliageHighlight;
  ctx.beginPath();
  ctx.ellipse(-3 * scale + windSway * 0.6, centerY - 5, 4 * scale, 3 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
}

// ============================================================================
// MOUNTAIN RENDERING - Enhanced peaks with better shading
// ============================================================================

/**
 * Draw enhanced mountain/metal deposit tile
 */
export function drawMountainTile(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  hasOre: boolean = true,
  zoom: number = 1
): void {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = screenX + w / 2;
  const cy = screenY + h / 2;
  
  // Base rocky ground
  const baseGradient = ctx.createLinearGradient(screenX, screenY, screenX + w, screenY + h);
  baseGradient.addColorStop(0, MOUNTAIN_COLORS.rockMid);
  baseGradient.addColorStop(0.5, MOUNTAIN_COLORS.rockWarm);
  baseGradient.addColorStop(1, MOUNTAIN_COLORS.rockDark);
  
  ctx.fillStyle = baseGradient;
  ctx.beginPath();
  ctx.moveTo(cx, screenY);
  ctx.lineTo(screenX + w, cy);
  ctx.lineTo(cx, screenY + h);
  ctx.lineTo(screenX, cy);
  ctx.closePath();
  ctx.fill();
  
  // Seed for deterministic variation
  const seed = gridX * 1000 + gridY;
  
  // Draw mountain peaks (clustered, varying heights)
  const numPeaks = 5 + (seed % 4);
  const peakPositions = [
    { dx: 0.5, dy: 0.25, sizeMult: 1.4, heightMult: 1.3 },
    { dx: 0.35, dy: 0.32, sizeMult: 1.2, heightMult: 1.1 },
    { dx: 0.65, dy: 0.30, sizeMult: 1.15, heightMult: 1.15 },
    { dx: 0.42, dy: 0.42, sizeMult: 1.0, heightMult: 0.9 },
    { dx: 0.58, dy: 0.44, sizeMult: 1.05, heightMult: 0.95 },
    { dx: 0.50, dy: 0.52, sizeMult: 0.85, heightMult: 0.75 },
    { dx: 0.30, dy: 0.50, sizeMult: 0.7, heightMult: 0.65 },
    { dx: 0.70, dy: 0.48, sizeMult: 0.75, heightMult: 0.7 },
  ];
  
  for (let i = 0; i < Math.min(numPeaks, peakPositions.length); i++) {
    const pos = peakPositions[i];
    const mSeed = seed * 7 + i * 13;
    
    const baseX = screenX + w * pos.dx + ((mSeed % 5) - 2.5) * 0.5;
    const baseY = screenY + h * pos.dy + ((mSeed * 3 % 4) - 2) * 0.3;
    const baseWidth = (14 + (mSeed % 5)) * pos.sizeMult * zoom;
    const peakHeight = (18 + (mSeed * 2 % 8)) * pos.heightMult * zoom;
    const peakX = baseX + ((mSeed % 3) - 1) * 0.5;
    const peakY = baseY - peakHeight;
    
    // Left face (shadow)
    ctx.fillStyle = MOUNTAIN_COLORS.rockShadow;
    ctx.beginPath();
    ctx.moveTo(peakX, peakY);
    ctx.lineTo(baseX - baseWidth * 0.5, baseY);
    ctx.lineTo(baseX, baseY);
    ctx.closePath();
    ctx.fill();
    
    // Right face (lit)
    ctx.fillStyle = MOUNTAIN_COLORS.rockLight;
    ctx.beginPath();
    ctx.moveTo(peakX, peakY);
    ctx.lineTo(baseX, baseY);
    ctx.lineTo(baseX + baseWidth * 0.5, baseY);
    ctx.closePath();
    ctx.fill();
    
    // Ridge line
    if (pos.heightMult > 0.8) {
      ctx.strokeStyle = MOUNTAIN_COLORS.rockDark;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(peakX, peakY);
      ctx.lineTo(baseX, baseY);
      ctx.stroke();
    }
    
    // Snow cap on tall peaks
    if (pos.heightMult >= 1.0) {
      const snowHeight = peakHeight * 0.28;
      ctx.fillStyle = MOUNTAIN_COLORS.snowBright;
      ctx.beginPath();
      ctx.moveTo(peakX, peakY);
      ctx.lineTo(peakX - baseWidth * 0.12, peakY + snowHeight);
      ctx.lineTo(peakX + baseWidth * 0.12, peakY + snowHeight);
      ctx.closePath();
      ctx.fill();
      
      // Snow shadow
      ctx.fillStyle = MOUNTAIN_COLORS.snowShadow;
      ctx.beginPath();
      ctx.moveTo(peakX, peakY + snowHeight * 0.3);
      ctx.lineTo(peakX - baseWidth * 0.08, peakY + snowHeight);
      ctx.lineTo(peakX, peakY + snowHeight);
      ctx.closePath();
      ctx.fill();
    }
  }
  
  // Ore deposits at base
  if (hasOre) {
    drawOreDeposits(ctx, screenX, screenY, gridX, gridY, w, h, seed, zoom);
  }
  
  // Boulders
  drawBoulders(ctx, screenX, screenY, w, h, seed, zoom);
}

function drawOreDeposits(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  w: number,
  h: number,
  seed: number,
  zoom: number
): void {
  const numDeposits = 4 + (seed % 3);
  const positions = [
    { dx: 0.28, dy: 0.72 },
    { dx: 0.42, dy: 0.76 },
    { dx: 0.58, dy: 0.74 },
    { dx: 0.72, dy: 0.70 },
    { dx: 0.38, dy: 0.68 },
    { dx: 0.62, dy: 0.70 },
  ];
  
  for (let i = 0; i < Math.min(numDeposits, positions.length); i++) {
    const pos = positions[i];
    const oSeed = seed * 11 + i * 17;
    const ox = screenX + w * pos.dx + ((oSeed % 4) - 2) * zoom;
    const oy = screenY + h * pos.dy + ((oSeed * 2 % 3) - 1) * zoom;
    const oSize = (1.5 + (oSeed % 2)) * zoom;
    
    // Dark ore with diamond shape
    ctx.fillStyle = MOUNTAIN_COLORS.oreDark;
    ctx.beginPath();
    ctx.moveTo(ox, oy - oSize);
    ctx.lineTo(ox + oSize, oy);
    ctx.lineTo(ox, oy + oSize);
    ctx.lineTo(ox - oSize, oy);
    ctx.closePath();
    ctx.fill();
    
    // Metallic glint
    ctx.fillStyle = MOUNTAIN_COLORS.oreGlint;
    ctx.fillRect(ox - 0.5 * zoom, oy - 0.5 * zoom, 1 * zoom, 1 * zoom);
  }
}

function drawBoulders(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  w: number,
  h: number,
  seed: number,
  zoom: number
): void {
  const numBoulders = 6 + (seed % 4);
  
  for (let i = 0; i < numBoulders; i++) {
    const bSeed = seed * 19 + i * 23;
    const bx = screenX + w * 0.2 + ((bSeed % 100) / 100) * w * 0.6;
    const by = screenY + h * 0.60 + ((bSeed * 3 % 50) / 100) * h * 0.32;
    const bSize = (2 + (bSeed % 3)) * zoom;
    
    // Boulder
    ctx.fillStyle = MOUNTAIN_COLORS.rockMid;
    ctx.beginPath();
    ctx.arc(bx, by, bSize, 0, Math.PI * 2);
    ctx.fill();
    
    // Highlight
    ctx.fillStyle = MOUNTAIN_COLORS.rockLight;
    ctx.beginPath();
    ctx.arc(bx - bSize * 0.25, by - bSize * 0.25, bSize * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ============================================================================
// ATMOSPHERIC EFFECTS - Sky, lighting, particles
// ============================================================================

/**
 * Draw enhanced sky background with dynamic lighting
 */
export function drawEnhancedSkyBackground(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  timeOfDay: 'day' | 'night' | 'dawn' | 'dusk' = 'day',
  animTime: number = 0
): void {
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.width / dpr;
  const height = canvas.height / dpr;
  
  // Create gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  
  switch (timeOfDay) {
    case 'night':
      gradient.addColorStop(0, '#0a1628');
      gradient.addColorStop(0.3, '#0f1e32');
      gradient.addColorStop(0.6, '#14263d');
      gradient.addColorStop(1, '#1a3a2e');
      break;
      
    case 'dawn':
      gradient.addColorStop(0, '#1a365d');
      gradient.addColorStop(0.3, '#2d4a6a');
      gradient.addColorStop(0.6, '#7c5a40');
      gradient.addColorStop(1, '#c47a50');
      break;
      
    case 'dusk':
      gradient.addColorStop(0, '#2d1b4e');
      gradient.addColorStop(0.3, '#4a2a5a');
      gradient.addColorStop(0.6, '#8a4a40');
      gradient.addColorStop(1, '#2a3a3a');
      break;
      
    default: // day
      gradient.addColorStop(0, '#1e4a6a');
      gradient.addColorStop(0.2, '#2a5a7a');
      gradient.addColorStop(0.5, '#3a6a85');
      gradient.addColorStop(0.8, '#2a5a50');
      gradient.addColorStop(1, '#1a4a3a');
  }
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  
  // Add subtle animated clouds for day/dawn/dusk
  if (timeOfDay !== 'night') {
    drawClouds(ctx, width, height, animTime, timeOfDay);
  }
  
  // Stars for night
  if (timeOfDay === 'night') {
    drawStars(ctx, width, height, animTime);
  }
}

function drawClouds(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  animTime: number,
  timeOfDay: string
): void {
  ctx.save();
  ctx.globalAlpha = timeOfDay === 'day' ? 0.15 : 0.1;
  
  const cloudColor = timeOfDay === 'dusk' ? '#d4a088' : '#ffffff';
  ctx.fillStyle = cloudColor;
  
  // Draw a few cloud shapes
  for (let i = 0; i < 5; i++) {
    const cloudX = ((animTime * 0.02 + i * 0.2) % 1.2 - 0.1) * width;
    const cloudY = 30 + i * 25;
    const cloudWidth = 80 + i * 20;
    
    ctx.beginPath();
    ctx.ellipse(cloudX, cloudY, cloudWidth, 15, 0, 0, Math.PI * 2);
    ctx.ellipse(cloudX - cloudWidth * 0.3, cloudY + 5, cloudWidth * 0.6, 12, 0, 0, Math.PI * 2);
    ctx.ellipse(cloudX + cloudWidth * 0.3, cloudY + 3, cloudWidth * 0.5, 10, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  
  ctx.restore();
}

function drawStars(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  animTime: number
): void {
  ctx.save();
  
  // Fixed star positions (deterministic)
  const stars = [
    { x: 0.1, y: 0.05, size: 1.5 },
    { x: 0.25, y: 0.08, size: 1 },
    { x: 0.4, y: 0.03, size: 1.2 },
    { x: 0.55, y: 0.1, size: 0.8 },
    { x: 0.7, y: 0.04, size: 1.3 },
    { x: 0.85, y: 0.07, size: 1 },
    { x: 0.15, y: 0.15, size: 0.9 },
    { x: 0.35, y: 0.12, size: 1.1 },
    { x: 0.6, y: 0.18, size: 0.8 },
    { x: 0.8, y: 0.14, size: 1 },
  ];
  
  for (const star of stars) {
    const twinkle = 0.5 + Math.sin(animTime * 3 + star.x * 10) * 0.5;
    ctx.globalAlpha = twinkle * 0.8;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(star.x * width, star.y * height, star.size, 0, Math.PI * 2);
    ctx.fill();
  }
  
  ctx.restore();
}

// ============================================================================
// UNIT ENHANCEMENT - Better shadows and effects
// ============================================================================

/**
 * Draw unit shadow on ground
 */
export function drawUnitShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  intensity: number = 0.3
): void {
  ctx.save();
  ctx.globalAlpha = intensity;
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.ellipse(x, y + height * 0.1, width * 0.8, height * 0.3, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Draw wake effect behind naval units
 */
export function drawWakeEffect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  heading: number,
  speed: number,
  animTime: number
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading + Math.PI);
  
  const wakeLength = 15 + speed * 5;
  const wakeWidth = 8 + speed * 2;
  
  // V-shaped wake
  const wakeGradient = ctx.createLinearGradient(0, 0, wakeLength, 0);
  wakeGradient.addColorStop(0, 'rgba(255,255,255,0.5)');
  wakeGradient.addColorStop(0.5, 'rgba(255,255,255,0.3)');
  wakeGradient.addColorStop(1, 'rgba(255,255,255,0)');
  
  ctx.fillStyle = wakeGradient;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(wakeLength, -wakeWidth / 2);
  ctx.lineTo(wakeLength, wakeWidth / 2);
  ctx.closePath();
  ctx.fill();
  
  // Foam at edges
  const foamPhase = animTime * 3;
  ctx.strokeStyle = `rgba(255,255,255,${0.3 + Math.sin(foamPhase) * 0.1})`;
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 2]);
  ctx.beginPath();
  ctx.moveTo(2, 0);
  ctx.lineTo(wakeLength * 0.7, -wakeWidth * 0.4);
  ctx.moveTo(2, 0);
  ctx.lineTo(wakeLength * 0.7, wakeWidth * 0.4);
  ctx.stroke();
  ctx.setLineDash([]);
  
  ctx.restore();
}

/**
 * Draw rotor/propeller blur effect for aircraft
 */
export function drawRotorEffect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  animTime: number,
  isHelicopter: boolean = false
): void {
  ctx.save();
  ctx.translate(x, y);
  
  if (isHelicopter) {
    // Circular blur disc
    const rotorGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
    rotorGradient.addColorStop(0, 'rgba(100,100,100,0.2)');
    rotorGradient.addColorStop(0.7, 'rgba(100,100,100,0.3)');
    rotorGradient.addColorStop(1, 'rgba(100,100,100,0.1)');
    
    ctx.fillStyle = rotorGradient;
    ctx.beginPath();
    ctx.ellipse(0, 0, radius, radius * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Propeller blur (elliptical)
    ctx.fillStyle = 'rgba(80,80,80,0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * 0.15, radius, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  
  ctx.restore();
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Linear interpolation between two hex colors
 */
function lerpColor(color1: string, color2: string, t: number): string {
  const c1 = hexToRgb(color1);
  const c2 = hexToRgb(color2);
  
  const r = Math.round(c1.r + (c2.r - c1.r) * t);
  const g = Math.round(c1.g + (c2.g - c1.g) * t);
  const b = Math.round(c1.b + (c2.b - c1.b) * t);
  
  return `rgb(${r},${g},${b})`;
}

/**
 * Convert hex color to RGB object
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  } : { r: 0, g: 0, b: 0 };
}

/**
 * Convert hex color to rgba string
 */
function hexToRgba(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
}

// ============================================================================
// EXPORTS - All enhanced graphics functions
// ============================================================================

export {
  TERRAIN_COLORS,
  WATER_COLORS,
  BEACH_COLORS,
  FOREST_COLORS,
  MOUNTAIN_COLORS,
};
