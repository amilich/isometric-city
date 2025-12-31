/**
 * Rise of Nations - Enhanced Graphics System
 * 
 * Provides realistic, polished terrain and water rendering with:
 * - Procedural noise-based grass/dirt blending
 * - Depth-based water with animated waves and foam
 * - Wet/dry beach gradients with animated foam
 * - Layered forests with wind sway and shadows
 * - Mountains with shading, snowlines, and ore glints
 * - Atmospheric lighting and sky backgrounds
 */

import { createNoise2D, createNoise3D, NoiseFunction2D, NoiseFunction3D } from 'simplex-noise';
import { TILE_WIDTH, TILE_HEIGHT } from '@/components/game/shared';

// ============================================================================
// Noise Generation - Cached for Performance
// ============================================================================

// Create deterministic noise functions (seeded for consistency)
let terrainNoise2D: NoiseFunction2D | null = null;
let waterNoise3D: NoiseFunction3D | null = null;
let foliageNoise2D: NoiseFunction2D | null = null;
let detailNoise2D: NoiseFunction2D | null = null;

/**
 * Initialize noise functions with a seed for deterministic terrain
 */
export function initializeNoise(seed: number = 12345): void {
  // Create a simple seeded random function
  const seededRandom = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  
  terrainNoise2D = createNoise2D(seededRandom);
  waterNoise3D = createNoise3D(seededRandom);
  foliageNoise2D = createNoise2D(seededRandom);
  detailNoise2D = createNoise2D(seededRandom);
}

// Initialize on module load
initializeNoise();

/**
 * Get terrain noise at a position (returns -1 to 1)
 */
function getTerrainNoise(x: number, y: number, scale: number = 1): number {
  if (!terrainNoise2D) initializeNoise();
  return terrainNoise2D!(x * scale, y * scale);
}

/**
 * Get water noise at a position with time (returns -1 to 1)
 */
function getWaterNoise(x: number, y: number, time: number, scale: number = 1): number {
  if (!waterNoise3D) initializeNoise();
  return waterNoise3D!(x * scale, y * scale, time);
}

/**
 * Get foliage noise at a position (returns -1 to 1)
 */
function getFoliageNoise(x: number, y: number, scale: number = 1): number {
  if (!foliageNoise2D) initializeNoise();
  return foliageNoise2D!(x * scale, y * scale);
}

/**
 * Get detail noise at a position (returns -1 to 1)
 */
function getDetailNoise(x: number, y: number, scale: number = 1): number {
  if (!detailNoise2D) initializeNoise();
  return detailNoise2D!(x * scale, y * scale);
}

// ============================================================================
// Color Palette - Realistic Natural Tones
// ============================================================================

export const REALISTIC_COLORS = {
  // Grass tones (moving away from bright greens)
  grass: {
    base: '#5a7a4d',       // Muted olive-green
    light: '#6b8a5a',      // Lighter grass
    dark: '#4a6a3d',       // Shaded grass
    highlight: '#7a9a6a',  // Sun-lit grass
    dry: '#8a9060',        // Dried/summer grass
  },
  
  // Dirt/earth tones
  earth: {
    base: '#8b7355',       // Brown earth
    light: '#a08570',      // Light soil
    dark: '#6b5545',       // Dark soil
    path: '#9a8060',       // Path/worn areas
    mud: '#5a4a3a',        // Wet mud
  },
  
  // Water depth colors
  water: {
    shallow: '#4a90b0',    // Shallow coastal
    medium: '#3a7090',     // Medium depth
    deep: '#2a5070',       // Deep water
    deepest: '#1a3a50',    // Ocean depths
    foam: '#e8f4f8',       // Wave foam
    highlight: '#6ab0d0',  // Light reflection
  },
  
  // Beach/sand tones
  beach: {
    dry: '#d4c4a0',        // Dry sand
    wet: '#b0a080',        // Wet sand
    dark: '#a09070',       // Shaded sand
    foam: '#f0f8fc',       // Foam white
    shell: '#e8dcc8',      // Shell fragments
  },
  
  // Forest/tree tones
  forest: {
    canopy: '#3a5a2a',     // Dark forest canopy
    leaves: '#4a6a3a',     // Leaf green
    trunk: '#5a4030',      // Tree trunk brown
    shadow: '#2a3a1a',     // Deep shadow
    highlight: '#6a8a4a',  // Sunlit leaves
  },
  
  // Mountain/rock tones
  mountain: {
    rock: '#707070',       // Base rock
    light: '#909090',      // Light rock face
    dark: '#505050',       // Dark rock face
    snow: '#f0f8ff',       // Snow cap
    ore: '#8a7a50',        // Ore veins
    metalGlint: '#c0b090', // Metal ore glint
  },
  
  // Oil deposit tones
  oil: {
    surface: '#1a1a1a',    // Oil slick
    sheen: '#3a3a40',      // Rainbow sheen dark
    highlight: '#4a4a50',  // Slight highlight
  },
} as const;

// ============================================================================
// Terrain Rendering - Realistic Grass/Dirt Blend
// ============================================================================

/**
 * Draw a realistic grass tile with noise-based variation
 */
export function drawRealisticGrassTile(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  zoom: number = 1,
  time: number = 0
): void {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = screenX + w / 2;
  const cy = screenY + h / 2;
  
  // Get multi-octave noise for natural terrain variation
  const noise1 = getTerrainNoise(gridX * 0.1, gridY * 0.1);
  const noise2 = getTerrainNoise(gridX * 0.3 + 100, gridY * 0.3 + 100) * 0.5;
  const noise3 = getDetailNoise(gridX * 0.8 + 200, gridY * 0.8 + 200) * 0.25;
  const combinedNoise = (noise1 + noise2 + noise3) / 1.75;
  
  // Determine grass color based on noise
  const grassGreen = interpolateColor(
    REALISTIC_COLORS.grass.dark,
    REALISTIC_COLORS.grass.light,
    (combinedNoise + 1) / 2
  );
  
  // Add dirt patches where noise is low
  const dirtFactor = Math.max(0, -combinedNoise - 0.2);
  const finalColor = dirtFactor > 0 
    ? interpolateColor(grassGreen, REALISTIC_COLORS.earth.base, Math.min(dirtFactor * 2, 0.6))
    : grassGreen;
  
  // Clip to diamond shape
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx, screenY);
  ctx.lineTo(screenX + w, cy);
  ctx.lineTo(cx, screenY + h);
  ctx.lineTo(screenX, cy);
  ctx.closePath();
  ctx.clip();
  
  // Draw base color
  ctx.fillStyle = finalColor;
  ctx.fillRect(screenX, screenY, w, h);
  
  // Add grass texture when zoomed in
  if (zoom >= 0.6) {
    drawGrassTexture(ctx, screenX, screenY, w, h, gridX, gridY, zoom, time);
  }
  
  // Add ambient occlusion at edges (subtle darkening)
  drawTileAmbientOcclusion(ctx, screenX, screenY, w, h);
  
  ctx.restore();
  
  // Draw subtle grid line
  if (zoom >= 0.6) {
    ctx.strokeStyle = 'rgba(40, 60, 30, 0.3)';
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
 * Draw grass texture details (blades, patches)
 */
function drawGrassTexture(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  gridX: number,
  gridY: number,
  zoom: number,
  time: number
): void {
  const detailCount = Math.floor(12 * zoom);
  
  for (let i = 0; i < detailCount; i++) {
    // Deterministic positions based on grid and index
    const seed = (gridX * 17 + gridY * 31 + i * 7) % 1000;
    const px = x + (seed % 60) / 60 * w;
    const py = y + ((seed * 3) % 60) / 60 * h;
    
    // Check if point is inside diamond
    const relX = (px - x - w/2) / (w/2);
    const relY = (py - y - h/2) / (h/2);
    if (Math.abs(relX) + Math.abs(relY) > 0.9) continue;
    
    // Draw grass blade or detail
    const type = seed % 3;
    const brightness = 0.85 + (seed % 30) / 100;
    
    if (type === 0) {
      // Grass blade
      const windSway = Math.sin(time * 2 + seed * 0.1) * 0.5;
      ctx.strokeStyle = adjustBrightness(REALISTIC_COLORS.grass.base, brightness);
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + windSway, py - 2 - (seed % 2));
      ctx.stroke();
    } else if (type === 1) {
      // Small flower or plant
      ctx.fillStyle = seed % 5 === 0 
        ? '#e8e080' // Yellow flower
        : adjustBrightness(REALISTIC_COLORS.grass.highlight, brightness);
      ctx.beginPath();
      ctx.arc(px, py, 0.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Dirt speck
      ctx.fillStyle = adjustBrightness(REALISTIC_COLORS.earth.light, brightness);
      ctx.beginPath();
      ctx.arc(px, py, 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/**
 * Draw ambient occlusion effect at tile edges
 */
function drawTileAmbientOcclusion(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  const cx = x + w / 2;
  const cy = y + h / 2;
  
  // Create radial gradient for subtle edge darkening
  const gradient = ctx.createRadialGradient(cx, cy, w * 0.2, cx, cy, w * 0.5);
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0.08)');
  
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, w, h);
}

// ============================================================================
// Water Rendering - Depth-Based with Waves and Foam
// ============================================================================

/**
 * Draw a realistic water tile with depth-based coloring and animation
 */
export function drawRealisticWaterTile(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  time: number,
  adjacentWater: { north: boolean; east: boolean; south: boolean; west: boolean },
  waterDepth: number = 0.5 // 0 = shore, 1 = deep ocean
): void {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = screenX + w / 2;
  const cy = screenY + h / 2;
  
  // Clip to diamond shape
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx, screenY);
  ctx.lineTo(screenX + w, cy);
  ctx.lineTo(cx, screenY + h);
  ctx.lineTo(screenX, cy);
  ctx.closePath();
  ctx.clip();
  
  // Calculate depth-based base color
  const depthColor = getWaterDepthColor(waterDepth);
  
  // Add wave animation to color
  const waveOffset = getWaterNoise(gridX * 0.15, gridY * 0.15, time * 0.5);
  const animatedColor = adjustBrightness(depthColor, 1 + waveOffset * 0.08);
  
  // Draw base water color
  ctx.fillStyle = animatedColor;
  ctx.fillRect(screenX, screenY, w, h);
  
  // Draw wave patterns
  drawWavePatterns(ctx, screenX, screenY, w, h, gridX, gridY, time);
  
  // Draw light caustics (underwater light ripples)
  drawCaustics(ctx, screenX, screenY, w, h, gridX, gridY, time, waterDepth);
  
  // Draw specular highlights
  drawWaterHighlights(ctx, screenX, screenY, w, h, gridX, gridY, time);
  
  ctx.restore();
}

/**
 * Get water color based on depth
 */
function getWaterDepthColor(depth: number): string {
  if (depth < 0.2) {
    return interpolateColor(REALISTIC_COLORS.water.shallow, REALISTIC_COLORS.water.medium, depth / 0.2);
  } else if (depth < 0.5) {
    return interpolateColor(REALISTIC_COLORS.water.medium, REALISTIC_COLORS.water.deep, (depth - 0.2) / 0.3);
  } else {
    return interpolateColor(REALISTIC_COLORS.water.deep, REALISTIC_COLORS.water.deepest, (depth - 0.5) / 0.5);
  }
}

/**
 * Draw animated wave patterns on water
 */
function drawWavePatterns(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  gridX: number,
  gridY: number,
  time: number
): void {
  // Multiple wave layers for realism
  for (let layer = 0; layer < 3; layer++) {
    const speed = 0.3 + layer * 0.15;
    const scale = 0.08 + layer * 0.04;
    const alpha = 0.06 - layer * 0.015;
    
    const wavePhase = time * speed + layer * 1.5;
    
    // Draw wave lines
    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.lineWidth = 1 - layer * 0.2;
    
    for (let i = 0; i < 4; i++) {
      const offset = (gridX + gridY + i + wavePhase) * scale;
      const yOffset = Math.sin(offset * Math.PI * 2) * 3;
      
      ctx.beginPath();
      ctx.moveTo(x, y + h * 0.3 + i * 8 + yOffset);
      ctx.quadraticCurveTo(
        x + w * 0.5, y + h * 0.3 + i * 8 + yOffset + 2,
        x + w, y + h * 0.3 + i * 8 + yOffset
      );
      ctx.stroke();
    }
  }
}

/**
 * Draw underwater light caustics
 */
function drawCaustics(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  gridX: number,
  gridY: number,
  time: number,
  depth: number
): void {
  // Caustics are more visible in shallow water
  const intensity = Math.max(0, 0.15 - depth * 0.15);
  if (intensity < 0.02) return;
  
  const causticCount = 5;
  
  for (let i = 0; i < causticCount; i++) {
    const seed = (gridX * 13 + gridY * 17 + i * 23) % 100;
    const phase = time * 0.8 + seed * 0.1;
    
    const px = x + (seed % 80) / 80 * w + Math.sin(phase) * 3;
    const py = y + ((seed * 3) % 80) / 80 * h + Math.cos(phase * 0.7) * 3;
    const size = 4 + Math.sin(phase * 1.5) * 2;
    
    // Check if in diamond
    const relX = (px - x - w/2) / (w/2);
    const relY = (py - y - h/2) / (h/2);
    if (Math.abs(relX) + Math.abs(relY) > 0.85) continue;
    
    const gradient = ctx.createRadialGradient(px, py, 0, px, py, size);
    gradient.addColorStop(0, `rgba(150, 200, 255, ${intensity})`);
    gradient.addColorStop(1, 'rgba(150, 200, 255, 0)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(px, py, size, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Draw specular highlights on water surface
 */
function drawWaterHighlights(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  gridX: number,
  gridY: number,
  time: number
): void {
  const highlightCount = 3;
  
  for (let i = 0; i < highlightCount; i++) {
    const seed = (gridX * 19 + gridY * 29 + i * 37) % 100;
    const phase = time * 0.4 + seed * 0.15;
    
    const px = x + (seed % 70 + 15) / 100 * w;
    const py = y + ((seed * 2) % 70 + 15) / 100 * h;
    const intensity = 0.15 + Math.sin(phase) * 0.1;
    
    // Check if in diamond
    const relX = (px - x - w/2) / (w/2);
    const relY = (py - y - h/2) / (h/2);
    if (Math.abs(relX) + Math.abs(relY) > 0.75) continue;
    
    ctx.fillStyle = `rgba(255, 255, 255, ${intensity})`;
    ctx.beginPath();
    ctx.ellipse(px, py, 2, 1, Math.PI * 0.25, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ============================================================================
// Beach Rendering - Wet/Dry Gradients with Foam Animation
// ============================================================================

/**
 * Draw realistic beach on water tiles adjacent to land
 */
export function drawRealisticBeach(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  time: number,
  adjacentLand: { north: boolean; east: boolean; south: boolean; west: boolean }
): void {
  const { north, east, south, west } = adjacentLand;
  if (!north && !east && !south && !west) return;
  
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = screenX + w / 2;
  const cy = screenY + h / 2;
  
  // Beach width varies with wave animation
  const baseBeachWidth = w * 0.15;
  const waveOffset = Math.sin(time * 1.5 + gridX * 0.5 + gridY * 0.3) * 2;
  const beachWidth = baseBeachWidth + waveOffset;
  
  const corners = {
    top: { x: cx, y: screenY },
    right: { x: screenX + w, y: cy },
    bottom: { x: cx, y: screenY + h },
    left: { x: screenX, y: cy },
  };
  
  // Draw beach for each edge adjacent to land
  if (north) drawBeachEdgeRealistic(ctx, corners.left, corners.top, beachWidth, time, gridX, gridY, 'north');
  if (east) drawBeachEdgeRealistic(ctx, corners.top, corners.right, beachWidth, time, gridX, gridY, 'east');
  if (south) drawBeachEdgeRealistic(ctx, corners.right, corners.bottom, beachWidth, time, gridX, gridY, 'south');
  if (west) drawBeachEdgeRealistic(ctx, corners.bottom, corners.left, beachWidth, time, gridX, gridY, 'west');
  
  // Draw foam at the water's edge
  if (north) drawFoamLine(ctx, corners.left, corners.top, beachWidth, time, gridX, gridY);
  if (east) drawFoamLine(ctx, corners.top, corners.right, beachWidth, time, gridX, gridY);
  if (south) drawFoamLine(ctx, corners.right, corners.bottom, beachWidth, time, gridX, gridY);
  if (west) drawFoamLine(ctx, corners.bottom, corners.left, beachWidth, time, gridX, gridY);
}

/**
 * Draw a single beach edge with wet/dry gradient
 */
function drawBeachEdgeRealistic(
  ctx: CanvasRenderingContext2D,
  start: { x: number; y: number },
  end: { x: number; y: number },
  beachWidth: number,
  time: number,
  gridX: number,
  gridY: number,
  edge: string
): void {
  // Calculate inward direction
  const edgeDx = end.x - start.x;
  const edgeDy = end.y - start.y;
  const edgeLen = Math.hypot(edgeDx, edgeDy);
  
  // Perpendicular inward vector
  const perpX = -edgeDy / edgeLen;
  const perpY = edgeDx / edgeLen;
  
  // Create gradient from wet (at edge) to dry (toward center)
  const gradientStartX = (start.x + end.x) / 2;
  const gradientStartY = (start.y + end.y) / 2;
  const gradientEndX = gradientStartX + perpX * beachWidth;
  const gradientEndY = gradientStartY + perpY * beachWidth;
  
  const gradient = ctx.createLinearGradient(
    gradientStartX, gradientStartY,
    gradientEndX, gradientEndY
  );
  gradient.addColorStop(0, REALISTIC_COLORS.beach.wet);
  gradient.addColorStop(0.4, REALISTIC_COLORS.beach.dry);
  gradient.addColorStop(1, REALISTIC_COLORS.beach.dry);
  
  // Draw beach fill
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.lineTo(end.x + perpX * beachWidth, end.y + perpY * beachWidth);
  ctx.lineTo(start.x + perpX * beachWidth, start.y + perpY * beachWidth);
  ctx.closePath();
  ctx.fill();
  
  // Add sand texture
  drawSandTexture(ctx, start, end, perpX, perpY, beachWidth, gridX, gridY);
}

/**
 * Draw sand texture details
 */
function drawSandTexture(
  ctx: CanvasRenderingContext2D,
  start: { x: number; y: number },
  end: { x: number; y: number },
  perpX: number,
  perpY: number,
  beachWidth: number,
  gridX: number,
  gridY: number
): void {
  const detailCount = 8;
  
  for (let i = 0; i < detailCount; i++) {
    const t = (i + 0.5) / detailCount;
    const seed = (gridX * 13 + gridY * 17 + i * 7) % 100;
    
    const baseX = start.x + (end.x - start.x) * t;
    const baseY = start.y + (end.y - start.y) * t;
    const depth = (seed % 80) / 100 * beachWidth;
    
    const px = baseX + perpX * depth;
    const py = baseY + perpY * depth;
    
    // Shell or pebble
    if (seed % 5 === 0) {
      ctx.fillStyle = REALISTIC_COLORS.beach.shell;
      ctx.beginPath();
      ctx.ellipse(px, py, 1.2, 0.8, seed * 0.1, 0, Math.PI * 2);
      ctx.fill();
    } else if (seed % 7 === 0) {
      // Dark pebble
      ctx.fillStyle = REALISTIC_COLORS.beach.dark;
      ctx.beginPath();
      ctx.arc(px, py, 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/**
 * Draw animated foam line at water's edge
 */
function drawFoamLine(
  ctx: CanvasRenderingContext2D,
  start: { x: number; y: number },
  end: { x: number; y: number },
  beachWidth: number,
  time: number,
  gridX: number,
  gridY: number
): void {
  // Calculate inward direction
  const edgeDx = end.x - start.x;
  const edgeDy = end.y - start.y;
  const edgeLen = Math.hypot(edgeDx, edgeDy);
  const perpX = -edgeDy / edgeLen;
  const perpY = edgeDx / edgeLen;
  
  // Wave animation affects foam position
  const wavePhase = time * 2 + gridX * 0.3 + gridY * 0.4;
  const waveOffset = Math.sin(wavePhase) * 2 + 2;
  
  // Draw foam bubbles
  const foamCount = 12;
  for (let i = 0; i < foamCount; i++) {
    const t = i / foamCount;
    const seed = (gridX * 11 + gridY * 13 + i * 19) % 100;
    
    const baseX = start.x + (end.x - start.x) * t;
    const baseY = start.y + (end.y - start.y) * t;
    
    // Position foam at wave edge
    const foamDepth = waveOffset + (seed % 20) / 20 * 3;
    const px = baseX + perpX * foamDepth;
    const py = baseY + perpY * foamDepth;
    
    // Foam bubble size varies with wave
    const bubblePhase = wavePhase + seed * 0.1;
    const size = 1.5 + Math.sin(bubblePhase) * 0.5;
    const alpha = 0.6 + Math.sin(bubblePhase * 1.3) * 0.3;
    
    ctx.fillStyle = `rgba(248, 252, 255, ${alpha})`;
    ctx.beginPath();
    ctx.arc(px, py, size, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ============================================================================
// Forest Rendering - Layered Trees with Wind Sway
// ============================================================================

/**
 * Draw a forest tile with layered trees and shadows
 */
export function drawRealisticForest(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  forestDensity: number,
  time: number,
  zoom: number = 1
): void {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = screenX + w / 2;
  const cy = screenY + h / 2;
  
  // Draw ground shadow first
  ctx.fillStyle = REALISTIC_COLORS.forest.shadow;
  ctx.globalAlpha = 0.3;
  ctx.beginPath();
  ctx.moveTo(cx, screenY);
  ctx.lineTo(screenX + w, cy);
  ctx.lineTo(cx, screenY + h);
  ctx.lineTo(screenX, cy);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
  
  // Number of trees based on density
  const treeCount = Math.floor(2 + forestDensity * 5);
  
  // Draw trees with depth sorting
  const trees: Array<{ x: number; y: number; size: number; seed: number }> = [];
  
  for (let i = 0; i < treeCount; i++) {
    const seed = (gridX * 17 + gridY * 31 + i * 43) % 1000;
    const tx = screenX + (seed % 50 + 7) / 64 * w;
    const ty = screenY + ((seed * 3) % 40 + 12) / 64 * h;
    const size = 8 + (seed % 6);
    
    // Check if in diamond
    const relX = (tx - screenX - w/2) / (w/2);
    const relY = (ty - screenY - h/2) / (h/2);
    if (Math.abs(relX) + Math.abs(relY) > 0.8) continue;
    
    trees.push({ x: tx, y: ty, size, seed });
  }
  
  // Sort by y position for proper depth
  trees.sort((a, b) => a.y - b.y);
  
  // Draw each tree
  for (const tree of trees) {
    drawTree(ctx, tree.x, tree.y, tree.size, tree.seed, time, zoom);
  }
}

/**
 * Draw a single tree with wind sway animation
 */
function drawTree(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  seed: number,
  time: number,
  zoom: number
): void {
  // Wind sway
  const windSway = Math.sin(time * 1.5 + seed * 0.1) * 1.5;
  
  // Tree type based on seed
  const treeType = seed % 3;
  
  if (treeType === 0) {
    // Conifer/pine tree
    drawConiferTree(ctx, x, y, size, windSway, seed);
  } else if (treeType === 1) {
    // Deciduous/round tree
    drawDeciduousTree(ctx, x, y, size, windSway, seed);
  } else {
    // Oak-style tree
    drawOakTree(ctx, x, y, size, windSway, seed);
  }
}

/**
 * Draw a conifer/pine tree
 */
function drawConiferTree(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  sway: number,
  seed: number
): void {
  const trunkHeight = size * 0.4;
  const trunkWidth = size * 0.15;
  
  // Trunk
  ctx.fillStyle = REALISTIC_COLORS.forest.trunk;
  ctx.fillRect(x - trunkWidth / 2, y - trunkHeight, trunkWidth, trunkHeight);
  
  // Foliage layers (triangle stack)
  const layers = 3;
  for (let i = layers - 1; i >= 0; i--) {
    const layerY = y - trunkHeight - i * size * 0.35;
    const layerWidth = size * 0.6 - i * size * 0.1;
    const layerHeight = size * 0.5;
    
    const brightness = 0.9 + (seed % 20) / 100 + i * 0.05;
    ctx.fillStyle = adjustBrightness(REALISTIC_COLORS.forest.canopy, brightness);
    
    ctx.beginPath();
    ctx.moveTo(x + sway * (0.5 + i * 0.3), layerY - layerHeight);
    ctx.lineTo(x - layerWidth + sway * 0.3, layerY);
    ctx.lineTo(x + layerWidth + sway * 0.3, layerY);
    ctx.closePath();
    ctx.fill();
  }
}

/**
 * Draw a deciduous/round tree
 */
function drawDeciduousTree(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  sway: number,
  seed: number
): void {
  const trunkHeight = size * 0.5;
  const trunkWidth = size * 0.12;
  
  // Trunk
  ctx.fillStyle = REALISTIC_COLORS.forest.trunk;
  ctx.fillRect(x - trunkWidth / 2, y - trunkHeight, trunkWidth, trunkHeight);
  
  // Round canopy
  const canopySize = size * 0.6;
  const canopyY = y - trunkHeight - canopySize * 0.5;
  
  // Shadow layer
  ctx.fillStyle = REALISTIC_COLORS.forest.shadow;
  ctx.beginPath();
  ctx.arc(x + sway + 2, canopyY + 2, canopySize, 0, Math.PI * 2);
  ctx.fill();
  
  // Main canopy
  const brightness = 0.9 + (seed % 25) / 100;
  ctx.fillStyle = adjustBrightness(REALISTIC_COLORS.forest.leaves, brightness);
  ctx.beginPath();
  ctx.arc(x + sway, canopyY, canopySize, 0, Math.PI * 2);
  ctx.fill();
  
  // Highlight
  ctx.fillStyle = adjustBrightness(REALISTIC_COLORS.forest.highlight, 1.1);
  ctx.beginPath();
  ctx.arc(x + sway - canopySize * 0.3, canopyY - canopySize * 0.3, canopySize * 0.4, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Draw an oak-style tree with irregular canopy
 */
function drawOakTree(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  sway: number,
  seed: number
): void {
  const trunkHeight = size * 0.45;
  const trunkWidth = size * 0.18;
  
  // Trunk with slight taper
  ctx.fillStyle = REALISTIC_COLORS.forest.trunk;
  ctx.beginPath();
  ctx.moveTo(x - trunkWidth / 2, y);
  ctx.lineTo(x + trunkWidth / 2, y);
  ctx.lineTo(x + trunkWidth / 3, y - trunkHeight);
  ctx.lineTo(x - trunkWidth / 3, y - trunkHeight);
  ctx.closePath();
  ctx.fill();
  
  // Multiple overlapping circles for irregular canopy
  const blobCount = 4;
  for (let i = 0; i < blobCount; i++) {
    const angle = (seed + i * 90) * Math.PI / 180;
    const dist = size * 0.2;
    const blobX = x + sway + Math.cos(angle) * dist;
    const blobY = y - trunkHeight - size * 0.3 + Math.sin(angle) * dist * 0.5;
    const blobSize = size * 0.4 + (i % 2) * size * 0.1;
    
    const brightness = 0.85 + (i * 7 + seed) % 20 / 100;
    ctx.fillStyle = adjustBrightness(REALISTIC_COLORS.forest.leaves, brightness);
    ctx.beginPath();
    ctx.arc(blobX, blobY, blobSize, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ============================================================================
// Mountain Rendering - Shading, Snowlines, and Ore Glints
// ============================================================================

/**
 * Draw a realistic mountain/metal deposit tile
 */
export function drawRealisticMountain(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  hasMetalDeposit: boolean,
  zoom: number = 1,
  time: number = 0
): void {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = screenX + w / 2;
  const cy = screenY + h / 2;
  
  // Draw rocky base
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx, screenY);
  ctx.lineTo(screenX + w, cy);
  ctx.lineTo(cx, screenY + h);
  ctx.lineTo(screenX, cy);
  ctx.closePath();
  ctx.clip();
  
  // Base rock color with noise variation
  const noise = getTerrainNoise(gridX * 0.2, gridY * 0.2);
  const baseColor = adjustBrightness(REALISTIC_COLORS.mountain.rock, 0.9 + noise * 0.15);
  ctx.fillStyle = baseColor;
  ctx.fillRect(screenX, screenY, w, h);
  
  ctx.restore();
  
  // Draw 3D mountain peaks
  drawMountainPeaks(ctx, screenX, screenY, w, h, gridX, gridY);
  
  // Draw snow on peaks
  drawMountainSnow(ctx, screenX, screenY, w, h, gridX, gridY);
  
  // Draw ore veins if metal deposit
  if (hasMetalDeposit) {
    drawOreVeins(ctx, screenX, screenY, w, h, gridX, gridY, time);
  }
}

/**
 * Draw 3D mountain peaks
 */
function drawMountainPeaks(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  gridX: number,
  gridY: number
): void {
  const peakCount = 2 + (gridX + gridY) % 2;
  
  for (let i = 0; i < peakCount; i++) {
    const seed = (gridX * 23 + gridY * 37 + i * 47) % 100;
    const peakX = x + (25 + seed % 30) / 80 * w;
    const peakHeight = 15 + seed % 10;
    const peakWidth = 12 + seed % 8;
    const baseY = y + h * 0.6 - i * 5;
    
    // Dark side (left)
    ctx.fillStyle = REALISTIC_COLORS.mountain.dark;
    ctx.beginPath();
    ctx.moveTo(peakX, baseY - peakHeight);
    ctx.lineTo(peakX - peakWidth, baseY);
    ctx.lineTo(peakX, baseY);
    ctx.closePath();
    ctx.fill();
    
    // Light side (right)
    ctx.fillStyle = REALISTIC_COLORS.mountain.light;
    ctx.beginPath();
    ctx.moveTo(peakX, baseY - peakHeight);
    ctx.lineTo(peakX + peakWidth, baseY);
    ctx.lineTo(peakX, baseY);
    ctx.closePath();
    ctx.fill();
  }
}

/**
 * Draw snow on mountain peaks
 */
function drawMountainSnow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  gridX: number,
  gridY: number
): void {
  const seed = (gridX * 29 + gridY * 41) % 100;
  const snowAmount = 0.3 + seed / 200;
  
  // Snow cap on main peak
  const peakX = x + w * 0.45;
  const peakY = y + h * 0.3;
  
  ctx.fillStyle = REALISTIC_COLORS.mountain.snow;
  ctx.beginPath();
  ctx.moveTo(peakX, peakY);
  ctx.lineTo(peakX - 5, peakY + 6 * snowAmount);
  ctx.quadraticCurveTo(peakX, peakY + 4 * snowAmount, peakX + 5, peakY + 6 * snowAmount);
  ctx.closePath();
  ctx.fill();
}

/**
 * Draw ore veins with glinting animation
 */
function drawOreVeins(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  gridX: number,
  gridY: number,
  time: number
): void {
  const veinCount = 4;
  
  for (let i = 0; i < veinCount; i++) {
    const seed = (gridX * 31 + gridY * 43 + i * 53) % 100;
    const veinX = x + (20 + seed % 40) / 80 * w;
    const veinY = y + (30 + (seed * 2) % 30) / 80 * h;
    
    // Check if in diamond
    const relX = (veinX - x - w/2) / (w/2);
    const relY = (veinY - y - h/2) / (h/2);
    if (Math.abs(relX) + Math.abs(relY) > 0.7) continue;
    
    // Ore vein base
    ctx.fillStyle = REALISTIC_COLORS.mountain.ore;
    ctx.beginPath();
    ctx.ellipse(veinX, veinY, 3, 2, seed * 0.05, 0, Math.PI * 2);
    ctx.fill();
    
    // Glint animation
    const glintPhase = time * 3 + seed * 0.2;
    const glintIntensity = Math.max(0, Math.sin(glintPhase)) * 0.8;
    
    if (glintIntensity > 0.1) {
      ctx.fillStyle = `rgba(255, 240, 180, ${glintIntensity})`;
      ctx.beginPath();
      ctx.arc(veinX - 1, veinY - 1, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ============================================================================
// Oil Deposit Rendering
// ============================================================================

/**
 * Draw a realistic oil deposit tile
 */
export function drawRealisticOilDeposit(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  time: number
): void {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = screenX + w / 2;
  const cy = screenY + h / 2;
  
  // Clip to diamond
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx, screenY);
  ctx.lineTo(screenX + w, cy);
  ctx.lineTo(cx, screenY + h);
  ctx.lineTo(screenX, cy);
  ctx.closePath();
  ctx.clip();
  
  // Dark oil base
  ctx.fillStyle = REALISTIC_COLORS.oil.surface;
  ctx.fillRect(screenX, screenY, w, h);
  
  // Rainbow sheen effect
  const sheenPhase = time * 0.5 + gridX * 0.3 + gridY * 0.2;
  
  for (let i = 0; i < 3; i++) {
    const seed = (gridX * 17 + gridY * 23 + i * 31) % 100;
    const sheenX = screenX + (20 + seed % 40) / 80 * w;
    const sheenY = screenY + (20 + (seed * 2) % 40) / 80 * h;
    
    // Check if in diamond
    const relX = (sheenX - screenX - w/2) / (w/2);
    const relY = (sheenY - screenY - h/2) / (h/2);
    if (Math.abs(relX) + Math.abs(relY) > 0.7) continue;
    
    // Rainbow gradient colors
    const hue = (sheenPhase * 60 + i * 40) % 360;
    const gradient = ctx.createRadialGradient(sheenX, sheenY, 0, sheenX, sheenY, 8);
    gradient.addColorStop(0, `hsla(${hue}, 60%, 40%, 0.3)`);
    gradient.addColorStop(0.5, `hsla(${(hue + 30) % 360}, 50%, 35%, 0.2)`);
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(sheenX, sheenY, 8, 0, Math.PI * 2);
    ctx.fill();
  }
  
  ctx.restore();
}

// ============================================================================
// Atmospheric Sky Rendering
// ============================================================================

/**
 * Draw an atmospheric sky background
 */
export function drawAtmosphericSky(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  time: number,
  timeOfDay: 'day' | 'dawn' | 'dusk' | 'night' = 'day'
): void {
  const width = canvas.width;
  const height = canvas.height;
  
  // Create sky gradient based on time of day
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  
  switch (timeOfDay) {
    case 'dawn':
      gradient.addColorStop(0, '#1a2a4a');
      gradient.addColorStop(0.3, '#4a3a5a');
      gradient.addColorStop(0.6, '#8a5a4a');
      gradient.addColorStop(1, '#2a4a3a');
      break;
    case 'dusk':
      gradient.addColorStop(0, '#2a1a4a');
      gradient.addColorStop(0.3, '#6a3a4a');
      gradient.addColorStop(0.6, '#4a3a5a');
      gradient.addColorStop(1, '#1a3a3a');
      break;
    case 'night':
      gradient.addColorStop(0, '#0a0a1a');
      gradient.addColorStop(0.4, '#101020');
      gradient.addColorStop(1, '#0a1a15');
      break;
    default: // day
      gradient.addColorStop(0, '#2a4a6a');
      gradient.addColorStop(0.4, '#4a6a8a');
      gradient.addColorStop(1, '#2a5a4a');
  }
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  
  // Add subtle cloud layer for day/dawn/dusk
  if (timeOfDay !== 'night') {
    drawClouds(ctx, width, height, time);
  } else {
    // Add stars for night
    drawStars(ctx, width, height, time);
  }
}

/**
 * Draw subtle cloud layer
 */
function drawClouds(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number
): void {
  const cloudCount = 5;
  
  for (let i = 0; i < cloudCount; i++) {
    const seed = i * 1234;
    const baseX = ((seed % 1000) / 1000 * width + time * 10) % (width + 200) - 100;
    const baseY = 50 + (seed * 3 % 100);
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    
    // Cloud puffs
    for (let j = 0; j < 4; j++) {
      const puffX = baseX + j * 30 + (seed * j % 20);
      const puffY = baseY + (seed * j * 2 % 15);
      const puffSize = 15 + (seed * j % 10);
      
      ctx.beginPath();
      ctx.arc(puffX, puffY, puffSize, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/**
 * Draw stars for night sky
 */
function drawStars(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number
): void {
  const starCount = 50;
  
  for (let i = 0; i < starCount; i++) {
    const seed = i * 7919;
    const x = (seed % 1000) / 1000 * width;
    const y = (seed * 3 % 500) / 500 * height * 0.6;
    
    // Twinkle animation
    const twinkle = Math.sin(time * 2 + seed * 0.01) * 0.3 + 0.7;
    const size = 0.5 + (seed % 10) / 20;
    
    ctx.fillStyle = `rgba(255, 255, 255, ${twinkle * 0.5})`;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Interpolate between two hex colors
 */
function interpolateColor(color1: string, color2: string, factor: number): string {
  const c1 = hexToRgb(color1);
  const c2 = hexToRgb(color2);
  
  const r = Math.round(c1.r + (c2.r - c1.r) * factor);
  const g = Math.round(c1.g + (c2.g - c1.g) * factor);
  const b = Math.round(c1.b + (c2.b - c1.b) * factor);
  
  return rgbToHex(r, g, b);
}

/**
 * Adjust brightness of a hex color
 */
function adjustBrightness(color: string, factor: number): string {
  const rgb = hexToRgb(color);
  const r = Math.min(255, Math.max(0, Math.round(rgb.r * factor)));
  const g = Math.min(255, Math.max(0, Math.round(rgb.g * factor)));
  const b = Math.min(255, Math.max(0, Math.round(rgb.b * factor)));
  return rgbToHex(r, g, b);
}

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}

/**
 * Convert RGB to hex color
 */
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

// ============================================================================
// Performance: Cached Gradient Creation
// ============================================================================

const gradientCache = new Map<string, CanvasGradient>();

/**
 * Get or create a cached gradient
 */
export function getCachedGradient(
  ctx: CanvasRenderingContext2D,
  key: string,
  createGradient: () => CanvasGradient
): CanvasGradient {
  if (!gradientCache.has(key)) {
    gradientCache.set(key, createGradient());
  }
  return gradientCache.get(key)!;
}

/**
 * Clear gradient cache (call on context change)
 */
export function clearGradientCache(): void {
  gradientCache.clear();
}
