/**
 * Rise of Nations - Enhanced Graphics System
 * 
 * This module provides high-fidelity terrain, water, lighting, and effects rendering.
 * Uses procedural noise for natural-looking textures and modern canvas techniques
 * for beautiful visuals inspired by the original Rise of Nations game.
 */

import { createNoise2D, NoiseFunction2D } from 'simplex-noise';
import { TILE_WIDTH, TILE_HEIGHT, gridToScreen } from '@/components/game/shared';

// ============================================================================
// NOISE GENERATORS (initialized lazily)
// ============================================================================

let terrainNoise: NoiseFunction2D | null = null;
let grassDetailNoise: NoiseFunction2D | null = null;
let waterNoise: NoiseFunction2D | null = null;
let waveNoise: NoiseFunction2D | null = null;
let cloudNoise: NoiseFunction2D | null = null;

function getTerrainNoise(): NoiseFunction2D {
  if (!terrainNoise) terrainNoise = createNoise2D();
  return terrainNoise;
}

function getGrassDetailNoise(): NoiseFunction2D {
  if (!grassDetailNoise) grassDetailNoise = createNoise2D();
  return grassDetailNoise;
}

function getWaterNoise(): NoiseFunction2D {
  if (!waterNoise) waterNoise = createNoise2D();
  return waterNoise;
}

function getWaveNoise(): NoiseFunction2D {
  if (!waveNoise) waveNoise = createNoise2D();
  return waveNoise;
}

function getCloudNoise(): NoiseFunction2D {
  if (!cloudNoise) cloudNoise = createNoise2D();
  return cloudNoise;
}

// ============================================================================
// COLOR PALETTES
// ============================================================================

/** Enhanced grass color palette with natural variation */
export const ENHANCED_GRASS_COLORS = {
  // Base colors for procedural mixing
  base: { h: 110, s: 45, l: 35 },
  light: { h: 100, s: 55, l: 45 },
  dark: { h: 120, s: 40, l: 25 },
  accent: { h: 95, s: 50, l: 40 },
  // Border/stroke
  stroke: 'rgba(30, 60, 30, 0.3)',
};

/** Enhanced water color palette */
export const ENHANCED_WATER_COLORS = {
  deep: { h: 210, s: 70, l: 25 },
  mid: { h: 200, s: 65, l: 40 },
  shallow: { h: 190, s: 55, l: 55 },
  foam: { h: 195, s: 20, l: 90 },
  reflection: { h: 210, s: 30, l: 80 },
  sparkle: '#ffffff',
};

/** Enhanced sand/beach color palette */
export const ENHANCED_BEACH_COLORS = {
  dry: { h: 35, s: 45, l: 70 },
  wet: { h: 30, s: 40, l: 50 },
  dark: { h: 25, s: 35, l: 40 },
  foam: { h: 40, s: 15, l: 88 },
};

/** Forest color palette */
export const ENHANCED_FOREST_COLORS = {
  canopy: { h: 130, s: 50, l: 25 },
  highlight: { h: 110, s: 55, l: 40 },
  shadow: { h: 140, s: 45, l: 15 },
  trunk: { h: 25, s: 40, l: 25 },
};

/** Mountain color palette */
export const ENHANCED_MOUNTAIN_COLORS = {
  rock: { h: 220, s: 10, l: 45 },
  peak: { h: 220, s: 5, l: 65 },
  shadow: { h: 220, s: 15, l: 25 },
  snow: { h: 200, s: 10, l: 95 },
  ore: { h: 30, s: 60, l: 30 },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/** Convert HSL to CSS color string */
function hsl(h: number, s: number, l: number, a = 1): string {
  return a === 1 ? `hsl(${h}, ${s}%, ${l}%)` : `hsla(${h}, ${s}%, ${l}%, ${a})`;
}

/** Lerp between two values */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

/** Get octave noise for more natural patterns */
function octaveNoise(
  noise: NoiseFunction2D,
  x: number,
  y: number,
  octaves: number,
  persistence: number,
  scale: number
): number {
  let total = 0;
  let frequency = scale;
  let amplitude = 1;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    total += noise(x * frequency, y * frequency) * amplitude;
    maxValue += amplitude;
    amplitude *= persistence;
    frequency *= 2;
  }

  return total / maxValue;
}

// ============================================================================
// ENHANCED TERRAIN RENDERING
// ============================================================================

/**
 * Render enhanced grass terrain with procedural texturing
 */
export function drawEnhancedGrassTile(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  zoom: number,
  options: {
    ambient?: number; // 0-1 ambient light level
    highlight?: boolean;
    selected?: boolean;
  } = {}
): void {
  const { ambient = 1.0, highlight = false, selected = false } = options;
  const noise = getTerrainNoise();
  const detailNoise = getGrassDetailNoise();

  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = screenX + w / 2;
  const cy = screenY + h / 2;

  // Get procedural color variation based on position
  const colorNoise = octaveNoise(noise, gridX * 0.5, gridY * 0.5, 3, 0.5, 0.1);
  const detailVal = octaveNoise(detailNoise, gridX * 2, gridY * 2, 2, 0.6, 0.3);

  // Calculate base HSL values with noise
  const baseH = lerp(ENHANCED_GRASS_COLORS.dark.h, ENHANCED_GRASS_COLORS.light.h, (colorNoise + 1) / 2);
  const baseS = lerp(ENHANCED_GRASS_COLORS.dark.s, ENHANCED_GRASS_COLORS.light.s, (colorNoise + 1) / 2);
  const baseL = lerp(ENHANCED_GRASS_COLORS.dark.l, ENHANCED_GRASS_COLORS.light.l, (colorNoise + 1) / 2);

  // Apply ambient lighting
  const finalL = baseL * ambient;

  // Create gradient for the tile
  const gradient = ctx.createLinearGradient(
    screenX, screenY + h / 2,
    screenX + w, screenY + h / 2
  );
  gradient.addColorStop(0, hsl(baseH + 5, baseS - 5, finalL - 8));
  gradient.addColorStop(0.5, hsl(baseH, baseS, finalL));
  gradient.addColorStop(1, hsl(baseH - 5, baseS + 5, finalL + 5));

  // Draw base tile with gradient
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(cx, screenY);
  ctx.lineTo(screenX + w, cy);
  ctx.lineTo(cx, screenY + h);
  ctx.lineTo(screenX, cy);
  ctx.closePath();
  ctx.fill();

  // Add grass texture details when zoomed in
  if (zoom >= 0.6) {
    // Draw subtle grass blades/texture
    const numBlades = Math.floor(8 + detailVal * 4);
    ctx.save();
    
    // Clip to tile
    ctx.beginPath();
    ctx.moveTo(cx, screenY);
    ctx.lineTo(screenX + w, cy);
    ctx.lineTo(cx, screenY + h);
    ctx.lineTo(screenX, cy);
    ctx.closePath();
    ctx.clip();

    for (let i = 0; i < numBlades; i++) {
      const seed = (gridX * 17 + gridY * 31 + i * 7) % 100;
      const offsetX = (seed % 60 - 30) / 100 * w;
      const offsetY = ((seed * 3) % 60 - 30) / 100 * h;
      const bladeX = cx + offsetX;
      const bladeY = cy + offsetY;
      
      const bladeNoise = detailNoise(bladeX * 0.1, bladeY * 0.1);
      const bladeH = baseH + (bladeNoise * 15);
      const bladeL = finalL + (bladeNoise * 8) - 4;
      
      ctx.strokeStyle = hsl(bladeH, baseS - 10, bladeL, 0.4);
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(bladeX, bladeY);
      ctx.lineTo(bladeX + (bladeNoise * 2), bladeY - 2 - bladeNoise * 2);
      ctx.stroke();
    }

    ctx.restore();

    // Draw subtle grid line
    ctx.strokeStyle = ENHANCED_GRASS_COLORS.stroke;
    ctx.lineWidth = 0.3;
    ctx.beginPath();
    ctx.moveTo(cx, screenY);
    ctx.lineTo(screenX + w, cy);
    ctx.lineTo(cx, screenY + h);
    ctx.lineTo(screenX, cy);
    ctx.closePath();
    ctx.stroke();
  }

  // Highlight/selection overlay
  if (highlight || selected) {
    ctx.fillStyle = selected 
      ? 'rgba(34, 197, 94, 0.25)' 
      : 'rgba(255, 255, 255, 0.15)';
    ctx.beginPath();
    ctx.moveTo(cx, screenY);
    ctx.lineTo(screenX + w, cy);
    ctx.lineTo(cx, screenY + h);
    ctx.lineTo(screenX, cy);
    ctx.closePath();
    ctx.fill();
    
    ctx.strokeStyle = selected ? '#22c55e' : '#ffffff';
    ctx.lineWidth = selected ? 2 : 1.5;
    ctx.stroke();
  }
}

// ============================================================================
// ENHANCED WATER RENDERING
// ============================================================================

/** Animation state for water effects */
export interface WaterAnimationState {
  time: number;
  waveOffset: number;
}

/**
 * Render enhanced water tile with animated waves and reflections
 */
export function drawEnhancedWaterTile(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  animTime: number,
  zoom: number,
  adjacentWater: { north: boolean; east: boolean; south: boolean; west: boolean },
  options: {
    ambient?: number;
    sparkle?: boolean;
  } = {}
): void {
  const { ambient = 1.0, sparkle = true } = options;
  const waterNoiseFn = getWaterNoise();
  const waveNoiseFn = getWaveNoise();

  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = screenX + w / 2;
  const cy = screenY + h / 2;

  // Calculate water depth based on adjacent water (edges are shallower)
  const numAdjacentWater = [adjacentWater.north, adjacentWater.east, adjacentWater.south, adjacentWater.west]
    .filter(Boolean).length;
  const depth = numAdjacentWater / 4;

  // Animated noise values
  const waveVal = octaveNoise(waveNoiseFn, gridX * 0.3 + animTime * 0.5, gridY * 0.3, 2, 0.5, 0.2);
  const colorNoise = octaveNoise(waterNoiseFn, gridX * 0.5 + animTime * 0.1, gridY * 0.5, 3, 0.5, 0.15);

  // Calculate water colors based on depth and animation
  const deepColor = ENHANCED_WATER_COLORS.deep;
  const shallowColor = ENHANCED_WATER_COLORS.shallow;
  
  const waterH = lerp(shallowColor.h, deepColor.h, depth);
  const waterS = lerp(shallowColor.s, deepColor.s, depth);
  const waterL = lerp(shallowColor.l, deepColor.l, depth) * ambient;

  // Animated color shift
  const animatedH = waterH + waveVal * 5;
  const animatedL = waterL + colorNoise * 5;

  // Create animated gradient for water surface
  const gradient = ctx.createRadialGradient(
    cx + waveVal * 5, cy + waveVal * 3,
    0,
    cx, cy,
    w * 0.7
  );
  gradient.addColorStop(0, hsl(animatedH - 5, waterS + 5, animatedL + 8));
  gradient.addColorStop(0.5, hsl(animatedH, waterS, animatedL));
  gradient.addColorStop(1, hsl(animatedH + 5, waterS - 5, animatedL - 5));

  // Clip to tile shape
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx, screenY);
  ctx.lineTo(screenX + w, cy);
  ctx.lineTo(cx, screenY + h);
  ctx.lineTo(screenX, cy);
  ctx.closePath();
  ctx.clip();

  // Draw base water
  ctx.fillStyle = gradient;
  ctx.fillRect(screenX, screenY, w, h);

  // Draw wave patterns
  if (zoom >= 0.4) {
    const numWaves = 3;
    for (let i = 0; i < numWaves; i++) {
      const waveOffset = (animTime * 0.3 + i * 0.33) % 1;
      const waveY = screenY + h * 0.3 + waveOffset * h * 0.5;
      const waveAmplitude = 2 + waveVal * 2;
      
      ctx.strokeStyle = hsl(ENHANCED_WATER_COLORS.reflection.h, 
                           ENHANCED_WATER_COLORS.reflection.s, 
                           ENHANCED_WATER_COLORS.reflection.l, 
                           0.15 + (1 - waveOffset) * 0.2);
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      
      for (let x = screenX; x <= screenX + w; x += 3) {
        const localWave = waveNoiseFn((x + gridX * w) * 0.05, animTime);
        const py = waveY + localWave * waveAmplitude;
        if (x === screenX) {
          ctx.moveTo(x, py);
        } else {
          ctx.lineTo(x, py);
        }
      }
      ctx.stroke();
    }
  }

  // Draw sparkles/reflections
  if (sparkle && zoom >= 0.5) {
    const numSparkles = Math.floor(3 + depth * 2);
    for (let i = 0; i < numSparkles; i++) {
      const seed = (gridX * 13 + gridY * 29 + i * 11) % 100;
      const sparklePhase = (animTime * 2 + seed * 0.1) % 1;
      const sparkleIntensity = Math.max(0, Math.sin(sparklePhase * Math.PI));
      
      if (sparkleIntensity > 0.5) {
        const offsetX = (seed % 70 - 35) / 100 * w;
        const offsetY = ((seed * 3) % 60 - 30) / 100 * h;
        const sparkleX = cx + offsetX + waveVal * 3;
        const sparkleY = cy + offsetY;
        
        ctx.fillStyle = `rgba(255, 255, 255, ${sparkleIntensity * 0.7})`;
        ctx.beginPath();
        ctx.arc(sparkleX, sparkleY, 1 + sparkleIntensity, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  ctx.restore();

  // Draw subtle tile outline
  if (zoom >= 0.6) {
    ctx.strokeStyle = `rgba(50, 100, 150, 0.2)`;
    ctx.lineWidth = 0.3;
    ctx.beginPath();
    ctx.moveTo(cx, screenY);
    ctx.lineTo(screenX + w, cy);
    ctx.lineTo(cx, screenY + h);
    ctx.lineTo(screenX, cy);
    ctx.closePath();
    ctx.stroke();
  }
}

// ============================================================================
// ENHANCED BEACH RENDERING
// ============================================================================

/**
 * Draw enhanced beach/shore with gradients and sand texture
 */
export function drawEnhancedBeach(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  adjacentLand: { north: boolean; east: boolean; south: boolean; west: boolean },
  zoom: number,
  animTime: number
): void {
  const { north, east, south, west } = adjacentLand;
  if (!north && !east && !south && !west) return;

  const noise = getTerrainNoise();
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = screenX + w / 2;
  const cy = screenY + h / 2;

  // Beach width varies with noise for natural look
  const beachNoise = octaveNoise(noise, gridX * 0.8, gridY * 0.8, 2, 0.5, 0.3);
  const beachWidth = w * (0.12 + beachNoise * 0.04);

  // Get corners
  const corners = {
    top: { x: cx, y: screenY },
    right: { x: screenX + w, y: cy },
    bottom: { x: cx, y: screenY + h },
    left: { x: screenX, y: cy },
  };

  // Inward direction vectors
  const inwardVectors = {
    north: { dx: 0.707, dy: 0.707 },
    east: { dx: -0.707, dy: 0.707 },
    south: { dx: -0.707, dy: -0.707 },
    west: { dx: 0.707, dy: -0.707 },
  };

  // Draw beach on each edge with land
  const drawBeachEdge = (
    start: { x: number; y: number },
    end: { x: number; y: number },
    inward: { dx: number; dy: number },
    edgeName: string
  ) => {
    // Create gradient from wet (near water) to dry (near land)
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;
    const innerX = midX + inward.dx * beachWidth;
    const innerY = midY + inward.dy * beachWidth;

    const gradient = ctx.createLinearGradient(midX, midY, innerX, innerY);
    const wetColor = ENHANCED_BEACH_COLORS.wet;
    const dryColor = ENHANCED_BEACH_COLORS.dry;
    
    gradient.addColorStop(0, hsl(wetColor.h, wetColor.s, wetColor.l));
    gradient.addColorStop(0.4, hsl(
      lerp(wetColor.h, dryColor.h, 0.5),
      lerp(wetColor.s, dryColor.s, 0.5),
      lerp(wetColor.l, dryColor.l, 0.5)
    ));
    gradient.addColorStop(1, hsl(dryColor.h, dryColor.s, dryColor.l));

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.lineTo(end.x + inward.dx * beachWidth, end.y + inward.dy * beachWidth);
    ctx.lineTo(start.x + inward.dx * beachWidth, start.y + inward.dy * beachWidth);
    ctx.closePath();
    ctx.fill();

    // Draw foam line (animated)
    const foamOffset = (animTime * 0.5) % 1;
    const foamWidth = beachWidth * (0.2 + Math.sin(foamOffset * Math.PI) * 0.1);
    
    ctx.strokeStyle = hsl(ENHANCED_BEACH_COLORS.foam.h, 
                         ENHANCED_BEACH_COLORS.foam.s, 
                         ENHANCED_BEACH_COLORS.foam.l, 
                         0.3 + Math.sin(animTime * 2) * 0.1);
    ctx.lineWidth = foamWidth;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(
      start.x + inward.dx * beachWidth * 0.7 + Math.sin(animTime + foamOffset) * 0.5,
      start.y + inward.dy * beachWidth * 0.7
    );
    ctx.lineTo(
      end.x + inward.dx * beachWidth * 0.7 + Math.sin(animTime + foamOffset + 1) * 0.5,
      end.y + inward.dy * beachWidth * 0.7
    );
    ctx.stroke();
  };

  // Draw each beach edge
  if (north) drawBeachEdge(corners.left, corners.top, inwardVectors.north, 'north');
  if (east) drawBeachEdge(corners.top, corners.right, inwardVectors.east, 'east');
  if (south) drawBeachEdge(corners.right, corners.bottom, inwardVectors.south, 'south');
  if (west) drawBeachEdge(corners.bottom, corners.left, inwardVectors.west, 'west');

  // Draw sand texture when zoomed in
  if (zoom >= 0.7) {
    const numGrains = 8;
    for (let i = 0; i < numGrains; i++) {
      const seed = (gridX * 19 + gridY * 37 + i * 13) % 100;
      const edge = [north, east, south, west].findIndex((v, idx) => {
        return v && (seed % 4) === idx;
      });
      
      if (edge !== -1) {
        const edgeVec = [inwardVectors.north, inwardVectors.east, inwardVectors.south, inwardVectors.west][edge];
        const grainDist = (seed % 80) / 100 * beachWidth;
        const grainX = cx + edgeVec.dx * grainDist + (seed % 20 - 10);
        const grainY = cy + edgeVec.dy * grainDist + ((seed * 3) % 20 - 10);
        
        ctx.fillStyle = hsl(ENHANCED_BEACH_COLORS.dark.h, 
                           ENHANCED_BEACH_COLORS.dark.s, 
                           ENHANCED_BEACH_COLORS.dark.l + (seed % 20), 
                           0.3);
        ctx.beginPath();
        ctx.arc(grainX, grainY, 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

// ============================================================================
// ENHANCED FOREST RENDERING
// ============================================================================

/**
 * Draw enhanced procedural trees for forest tiles
 */
export function drawEnhancedForest(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  forestDensity: number,
  zoom: number,
  animTime: number
): void {
  const noise = getTerrainNoise();
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = screenX + w / 2;
  const cy = screenY + h / 2;

  // Calculate number of trees based on density
  const numTrees = Math.floor(4 + (forestDensity / 100) * 6);

  // Tree positions
  const treePositions = [
    { dx: 0.5, dy: 0.35, scale: 1.0 },
    { dx: 0.3, dy: 0.45, scale: 0.9 },
    { dx: 0.7, dy: 0.45, scale: 0.85 },
    { dx: 0.2, dy: 0.55, scale: 0.75 },
    { dx: 0.5, dy: 0.55, scale: 0.95 },
    { dx: 0.8, dy: 0.55, scale: 0.8 },
    { dx: 0.35, dy: 0.65, scale: 0.7 },
    { dx: 0.65, dy: 0.65, scale: 0.75 },
    { dx: 0.5, dy: 0.75, scale: 0.65 },
    { dx: 0.25, dy: 0.72, scale: 0.6 },
  ];

  for (let i = 0; i < Math.min(numTrees, treePositions.length); i++) {
    const pos = treePositions[i];
    const seed = (gridX * 31 + gridY * 17 + i * 7) % 100;
    const treeNoise = noise((gridX + i) * 0.5, (gridY + i) * 0.5);

    // Tree position with slight randomization
    const treeX = screenX + w * pos.dx + (seed % 10 - 5) * 0.02 * w;
    const treeY = screenY + h * pos.dy + ((seed * 3) % 10 - 5) * 0.02 * h;
    const scale = pos.scale * (0.9 + (seed % 20) / 100);

    // Tree dimensions
    const trunkHeight = 4 * scale * zoom;
    const trunkWidth = 1.5 * scale * zoom;
    const canopyRadius = 5 * scale * zoom;

    // Wind animation
    const windOffset = Math.sin(animTime + seed * 0.1) * 0.5 * scale;

    // Draw shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.beginPath();
    ctx.ellipse(treeX + 2, treeY + 1, canopyRadius * 0.7, canopyRadius * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Draw trunk
    ctx.fillStyle = hsl(ENHANCED_FOREST_COLORS.trunk.h, 
                       ENHANCED_FOREST_COLORS.trunk.s, 
                       ENHANCED_FOREST_COLORS.trunk.l);
    ctx.fillRect(treeX - trunkWidth / 2, treeY - trunkHeight, trunkWidth, trunkHeight);

    // Draw canopy layers for depth
    const canopyColor = ENHANCED_FOREST_COLORS.canopy;
    const highlightColor = ENHANCED_FOREST_COLORS.highlight;
    
    // Back layer (darker)
    ctx.fillStyle = hsl(canopyColor.h + 10, canopyColor.s, canopyColor.l - 5);
    ctx.beginPath();
    ctx.arc(treeX + windOffset * 0.5, treeY - trunkHeight - canopyRadius * 0.6, canopyRadius * 0.9, 0, Math.PI * 2);
    ctx.fill();

    // Main canopy
    ctx.fillStyle = hsl(canopyColor.h, canopyColor.s, canopyColor.l);
    ctx.beginPath();
    ctx.arc(treeX + windOffset, treeY - trunkHeight - canopyRadius * 0.8, canopyRadius * 0.85, 0, Math.PI * 2);
    ctx.fill();

    // Front highlight
    ctx.fillStyle = hsl(highlightColor.h, highlightColor.s, highlightColor.l, 0.6);
    ctx.beginPath();
    ctx.arc(treeX + windOffset * 0.7 - canopyRadius * 0.2, 
           treeY - trunkHeight - canopyRadius - canopyRadius * 0.1, 
           canopyRadius * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ============================================================================
// ENHANCED MOUNTAIN RENDERING
// ============================================================================

/**
 * Draw enhanced procedural mountain/ore deposit
 */
export function drawEnhancedMountain(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  hasMetalDeposit: boolean,
  zoom: number
): void {
  const noise = getTerrainNoise();
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = screenX + w / 2;
  const cy = screenY + h / 2;

  // Draw rocky base
  const baseGradient = ctx.createLinearGradient(screenX, screenY, screenX + w, screenY + h);
  const rockColor = ENHANCED_MOUNTAIN_COLORS.rock;
  const shadowColor = ENHANCED_MOUNTAIN_COLORS.shadow;
  
  baseGradient.addColorStop(0, hsl(rockColor.h, rockColor.s, rockColor.l));
  baseGradient.addColorStop(0.5, hsl(rockColor.h, rockColor.s, rockColor.l - 5));
  baseGradient.addColorStop(1, hsl(shadowColor.h, shadowColor.s, shadowColor.l));

  ctx.fillStyle = baseGradient;
  ctx.beginPath();
  ctx.moveTo(cx, screenY);
  ctx.lineTo(screenX + w, cy);
  ctx.lineTo(cx, screenY + h);
  ctx.lineTo(screenX, cy);
  ctx.closePath();
  ctx.fill();

  // Draw mountain peaks cluster
  const seed = gridX * 1000 + gridY;
  const numPeaks = 5 + (seed % 4);

  const peakPositions = [
    { dx: 0.5, dy: 0.28, sizeMult: 1.4 },
    { dx: 0.35, dy: 0.35, sizeMult: 1.1 },
    { dx: 0.65, dy: 0.35, sizeMult: 1.2 },
    { dx: 0.42, dy: 0.45, sizeMult: 0.9 },
    { dx: 0.58, dy: 0.48, sizeMult: 1.0 },
    { dx: 0.5, dy: 0.55, sizeMult: 0.8 },
    { dx: 0.32, dy: 0.52, sizeMult: 0.65 },
    { dx: 0.68, dy: 0.50, sizeMult: 0.7 },
  ];

  for (let i = 0; i < Math.min(numPeaks, peakPositions.length); i++) {
    const pos = peakPositions[i];
    const peakSeed = seed * 7 + i * 13;
    const peakNoise = noise((gridX + i) * 0.3, (gridY + i) * 0.3);

    const baseX = screenX + w * pos.dx + ((peakSeed % 5) - 2.5) * 0.5;
    const baseY = screenY + h * pos.dy + ((peakSeed * 3 % 4) - 2) * 0.3;
    const baseWidth = (12 + (peakSeed % 6)) * pos.sizeMult * (zoom > 0.5 ? 1 : 0.8);
    const peakHeight = (14 + (peakSeed * 2 % 10)) * pos.sizeMult * (zoom > 0.5 ? 1 : 0.8);

    const peakX = baseX + ((peakSeed % 3) - 1) * 0.5;
    const peakY = baseY - peakHeight;

    // Left face (shadow)
    ctx.fillStyle = hsl(shadowColor.h, shadowColor.s, shadowColor.l + (peakNoise * 5));
    ctx.beginPath();
    ctx.moveTo(peakX, peakY);
    ctx.lineTo(baseX - baseWidth * 0.5, baseY);
    ctx.lineTo(baseX, baseY);
    ctx.closePath();
    ctx.fill();

    // Right face (lit)
    const peakColor = ENHANCED_MOUNTAIN_COLORS.peak;
    ctx.fillStyle = hsl(peakColor.h, peakColor.s, peakColor.l);
    ctx.beginPath();
    ctx.moveTo(peakX, peakY);
    ctx.lineTo(baseX, baseY);
    ctx.lineTo(baseX + baseWidth * 0.5, baseY);
    ctx.closePath();
    ctx.fill();

    // Snow cap on taller peaks
    if (pos.sizeMult >= 1.0 && zoom >= 0.5) {
      const snowHeight = peakHeight * 0.2;
      ctx.fillStyle = hsl(ENHANCED_MOUNTAIN_COLORS.snow.h, 
                         ENHANCED_MOUNTAIN_COLORS.snow.s, 
                         ENHANCED_MOUNTAIN_COLORS.snow.l);
      ctx.beginPath();
      ctx.moveTo(peakX, peakY);
      ctx.lineTo(peakX - baseWidth * 0.08, peakY + snowHeight);
      ctx.lineTo(peakX + baseWidth * 0.08, peakY + snowHeight);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Draw ore deposits if present
  if (hasMetalDeposit && zoom >= 0.5) {
    const numOre = 4 + (seed % 3);
    const oreColor = ENHANCED_MOUNTAIN_COLORS.ore;
    
    for (let i = 0; i < numOre; i++) {
      const oreSeed = seed * 11 + i * 17;
      const oreX = screenX + w * 0.25 + ((oreSeed % 50) / 100) * w * 0.5;
      const oreY = screenY + h * 0.65 + ((oreSeed * 3 % 30) / 100) * h * 0.25;
      const oreSize = 2 + (oreSeed % 2);

      // Dark ore diamond
      ctx.fillStyle = hsl(oreColor.h, oreColor.s, oreColor.l - 10);
      ctx.beginPath();
      ctx.moveTo(oreX, oreY - oreSize);
      ctx.lineTo(oreX + oreSize, oreY);
      ctx.lineTo(oreX, oreY + oreSize);
      ctx.lineTo(oreX - oreSize, oreY);
      ctx.closePath();
      ctx.fill();

      // Metallic glint
      ctx.fillStyle = hsl(oreColor.h, oreColor.s - 20, oreColor.l + 30, 0.6);
      ctx.beginPath();
      ctx.arc(oreX - oreSize * 0.3, oreY - oreSize * 0.3, oreSize * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ============================================================================
// ENHANCED SKY & ATMOSPHERE
// ============================================================================

/**
 * Draw enhanced sky background with time-of-day lighting
 */
export function drawEnhancedSky(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  timeOfDay: 'day' | 'dawn' | 'dusk' | 'night',
  animTime: number
): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);

  switch (timeOfDay) {
    case 'night':
      gradient.addColorStop(0, '#0a0a1a');
      gradient.addColorStop(0.3, '#0f1428');
      gradient.addColorStop(0.6, '#141c24');
      gradient.addColorStop(1, '#0a1410');
      break;
    case 'dawn':
      gradient.addColorStop(0, '#1a2a5a');
      gradient.addColorStop(0.3, '#4a3055');
      gradient.addColorStop(0.5, '#8a4040');
      gradient.addColorStop(0.7, '#c07040');
      gradient.addColorStop(1, '#1a3020');
      break;
    case 'dusk':
      gradient.addColorStop(0, '#2a2055');
      gradient.addColorStop(0.3, '#552040');
      gradient.addColorStop(0.5, '#803535');
      gradient.addColorStop(0.7, '#a05530');
      gradient.addColorStop(1, '#1a2520');
      break;
    default: // day
      gradient.addColorStop(0, '#1a3560');
      gradient.addColorStop(0.2, '#255080');
      gradient.addColorStop(0.5, '#3070a0');
      gradient.addColorStop(0.7, '#306040');
      gradient.addColorStop(1, '#1a4030');
  }

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw subtle cloud shadows for day/dawn/dusk
  if (timeOfDay !== 'night') {
    const cloudNoiseFn = getCloudNoise();
    ctx.save();
    ctx.globalAlpha = 0.03;
    
    for (let y = 0; y < canvas.height; y += 50) {
      for (let x = 0; x < canvas.width; x += 50) {
        const cloudVal = octaveNoise(cloudNoiseFn, 
          (x + animTime * 10) * 0.002, 
          y * 0.003, 
          3, 0.5, 0.1);
        
        if (cloudVal > 0.3) {
          const intensity = (cloudVal - 0.3) / 0.7;
          ctx.fillStyle = `rgba(255, 255, 255, ${intensity * 0.3})`;
          ctx.beginPath();
          ctx.ellipse(x, y, 40 + intensity * 30, 20 + intensity * 15, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    
    ctx.restore();
  }
}

// ============================================================================
// UNIT SHADOW RENDERING
// ============================================================================

/**
 * Draw shadow under a unit
 */
export function drawUnitShadow(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  radius: number,
  elevation: number = 0
): void {
  const shadowOffset = 2 + elevation * 0.5;
  const shadowBlur = 3 + elevation * 2;
  
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.beginPath();
  ctx.ellipse(
    screenX + shadowOffset, 
    screenY + shadowOffset, 
    radius * 1.2, 
    radius * 0.5, 
    0, 0, Math.PI * 2
  );
  ctx.fill();
  ctx.restore();
}

// ============================================================================
// PARTICLE SYSTEM
// ============================================================================

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  type: 'smoke' | 'dust' | 'spark' | 'water_splash';
}

export class ParticleSystem {
  particles: Particle[] = [];
  maxParticles: number = 200;

  emit(
    x: number, 
    y: number, 
    type: Particle['type'], 
    count: number = 1
  ): void {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) {
        // Remove oldest particle
        this.particles.shift();
      }

      const particle: Particle = {
        x,
        y,
        vx: (Math.random() - 0.5) * 2,
        vy: -Math.random() * 2 - 1,
        life: 1,
        maxLife: 0.5 + Math.random() * 0.5,
        size: 2 + Math.random() * 3,
        color: this.getParticleColor(type),
        type,
      };

      // Adjust based on type
      switch (type) {
        case 'smoke':
          particle.vy = -Math.random() * 1 - 0.5;
          particle.size = 4 + Math.random() * 4;
          particle.maxLife = 1 + Math.random() * 1;
          break;
        case 'dust':
          particle.vx = (Math.random() - 0.5) * 3;
          particle.vy = -Math.random() * 1;
          particle.size = 2 + Math.random() * 2;
          break;
        case 'spark':
          particle.vx = (Math.random() - 0.5) * 4;
          particle.vy = -Math.random() * 4 - 2;
          particle.size = 1 + Math.random() * 2;
          particle.maxLife = 0.3 + Math.random() * 0.3;
          break;
        case 'water_splash':
          particle.vx = (Math.random() - 0.5) * 2;
          particle.vy = -Math.random() * 3 - 1;
          particle.size = 2 + Math.random() * 2;
          particle.maxLife = 0.4 + Math.random() * 0.3;
          break;
      }

      this.particles.push(particle);
    }
  }

  update(deltaTime: number): void {
    this.particles = this.particles.filter(p => {
      p.x += p.vx * deltaTime * 30;
      p.y += p.vy * deltaTime * 30;
      p.vy += 0.5 * deltaTime * 30; // Gravity
      p.life -= deltaTime / p.maxLife;

      // Type-specific updates
      if (p.type === 'smoke') {
        p.size += deltaTime * 3;
        p.vy -= 0.7 * deltaTime * 30; // Counteract gravity for smoke
      }

      return p.life > 0;
    });
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private getParticleColor(type: Particle['type']): string {
    switch (type) {
      case 'smoke': return 'rgba(80, 80, 80, 0.6)';
      case 'dust': return 'rgba(139, 119, 101, 0.5)';
      case 'spark': return 'rgba(255, 200, 50, 0.9)';
      case 'water_splash': return 'rgba(100, 180, 220, 0.7)';
      default: return 'rgba(255, 255, 255, 0.5)';
    }
  }
}

// Global particle system instance
export const globalParticles = new ParticleSystem();

// ============================================================================
// ENHANCED SELECTION/HIGHLIGHT EFFECTS
// ============================================================================

/**
 * Draw enhanced selection glow effect
 */
export function drawSelectionGlow(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  animTime: number
): void {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = screenX + w / 2;
  const cy = screenY + h / 2;

  // Pulsing glow
  const pulse = 0.5 + Math.sin(animTime * 4) * 0.2;
  
  // Outer glow
  ctx.strokeStyle = `rgba(34, 197, 94, ${0.3 * pulse})`;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx, screenY - 2);
  ctx.lineTo(screenX + w + 2, cy);
  ctx.lineTo(cx, screenY + h + 2);
  ctx.lineTo(screenX - 2, cy);
  ctx.closePath();
  ctx.stroke();

  // Inner bright line
  ctx.strokeStyle = `rgba(34, 197, 94, ${0.8 * pulse})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, screenY);
  ctx.lineTo(screenX + w, cy);
  ctx.lineTo(cx, screenY + h);
  ctx.lineTo(screenX, cy);
  ctx.closePath();
  ctx.stroke();

  // Corner highlights
  const cornerSize = 4;
  ctx.fillStyle = `rgba(255, 255, 255, ${0.8 * pulse})`;
  
  // Top corner
  ctx.beginPath();
  ctx.arc(cx, screenY, cornerSize, 0, Math.PI * 2);
  ctx.fill();
  
  // Right corner
  ctx.beginPath();
  ctx.arc(screenX + w, cy, cornerSize, 0, Math.PI * 2);
  ctx.fill();
  
  // Bottom corner
  ctx.beginPath();
  ctx.arc(cx, screenY + h, cornerSize, 0, Math.PI * 2);
  ctx.fill();
  
  // Left corner
  ctx.beginPath();
  ctx.arc(screenX, cy, cornerSize, 0, Math.PI * 2);
  ctx.fill();
}
