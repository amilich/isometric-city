/**
 * Rise of Nations - Enhanced Graphics Module
 * 
 * Provides realistic, high-fidelity terrain rendering with:
 * - Procedural noise-based terrain texturing
 * - Depth-based water with waves, foam, and transparency
 * - Realistic grass/dirt blends with ambient occlusion
 * - Natural-looking forests with wind animation
 * - Mountain ranges with snow caps and ore glints
 * - Atmospheric lighting and shadows
 */

import { createNoise2D, type NoiseFunction2D } from 'simplex-noise';
import { TILE_WIDTH, TILE_HEIGHT, gridToScreen } from '@/components/game/shared';

// ============================================================================
// NOISE GENERATORS - Cached for performance
// ============================================================================

// Create noise functions once and reuse
let terrainNoise: NoiseFunction2D | null = null;
let grassNoise: NoiseFunction2D | null = null;
let waterNoise: NoiseFunction2D | null = null;
let windNoise: NoiseFunction2D | null = null;

function getTerrainNoise(): NoiseFunction2D {
  if (!terrainNoise) terrainNoise = createNoise2D(() => 0.5);
  return terrainNoise;
}

function getGrassNoise(): NoiseFunction2D {
  if (!grassNoise) grassNoise = createNoise2D(() => 0.3);
  return grassNoise;
}

function getWaterNoise(): NoiseFunction2D {
  if (!waterNoise) waterNoise = createNoise2D(() => 0.7);
  return waterNoise;
}

function getWindNoise(): NoiseFunction2D {
  if (!windNoise) windNoise = createNoise2D(() => 0.9);
  return windNoise;
}

// ============================================================================
// COLOR PALETTES - Natural, muted, realistic tones
// ============================================================================

export const REALISTIC_COLORS = {
  // Grass/terrain - Natural earth tones, not cartoon green
  grass: {
    base: '#4a6741',      // Muted sage green
    light: '#5d7a54',     // Sunlit grass
    dark: '#3a5234',      // Shadowed grass
    dry: '#7a8b5a',       // Dried grass patches
    dirt: '#6b5844',      // Exposed earth
    shadow: '#2d3d27',    // Deep shadow
  },
  
  // Water - Deep, realistic ocean/lake tones
  water: {
    deep: '#1a4a6e',      // Deep water
    mid: '#2a6a8e',       // Mid-depth
    shallow: '#4a9aba',   // Shallow/coastal
    surface: '#5aafca',   // Surface highlights
    foam: '#d4e8f0',      // Wave foam
    foamEdge: '#a8c8d8',  // Foam edge
    reflection: '#7ac4e0', // Sky reflection
  },
  
  // Beach/sand - Warm natural tones
  beach: {
    dry: '#d4b896',       // Dry sand
    wet: '#a89878',       // Wet sand
    dark: '#8a7858',      // Shadow sand
    foam: '#e8e0d4',      // Beach foam
    pebble: '#7a6a58',    // Pebbles
  },
  
  // Mountain/rock - Natural stone colors
  mountain: {
    base: '#6b7278',      // Base rock
    light: '#8a9098',     // Lit face
    shadow: '#4a5058',    // Shadow face
    peak: '#9aa0a8',      // High peak
    snow: '#e8eef4',      // Snow cap
    snowShadow: '#c8d4e0', // Snow in shadow
    ore: '#3a3840',       // Metal ore
    oreGlint: '#8090a0',  // Ore metallic glint
  },
  
  // Forest - Rich, varied greens and browns
  forest: {
    canopyDark: '#2a4a2a',  // Deep canopy shadow
    canopyMid: '#3a5a3a',   // Mid canopy
    canopyLight: '#4a7048', // Sunlit canopy
    trunk: '#4a3a2a',       // Tree trunk
    undergrowth: '#3a4a34', // Forest floor
    highlight: '#6a8a58',   // Leaf highlights
  },
  
  // Sky/atmosphere
  sky: {
    zenith: '#1e4a6e',     // Top of sky
    horizon: '#4a7a9e',    // Horizon
    dawn: '#8a5a4a',       // Dawn tint
    dusk: '#6a4a6a',       // Dusk tint
    night: '#0a1a2a',      // Night sky
  },
  
  // Oil deposits - Industrial look
  oil: {
    base: '#1a1a20',       // Oil pool
    sheen: '#3a3a48',      // Oil sheen
    highlight: '#4a4a58',  // Reflection
    rainbow: ['#4a5868', '#5a4858', '#485858'], // Iridescence
  },
};

// ============================================================================
// ENHANCED GROUND TILE RENDERING
// ============================================================================

/**
 * Draw an enhanced realistic grass/ground tile with procedural variation
 */
export function drawEnhancedGroundTile(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  options: {
    zoom?: number;
    time?: number;
    ownerId?: string | null;
    playerColor?: string | null;
  } = {}
): void {
  const { zoom = 1, time = 0, ownerId, playerColor } = options;
  const noise = getTerrainNoise();
  const grassN = getGrassNoise();
  
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  
  // Generate terrain variation using noise
  const baseNoise = noise(gridX * 0.15, gridY * 0.15);
  const detailNoise = grassN(gridX * 0.5, gridY * 0.5) * 0.3;
  const combinedNoise = (baseNoise + detailNoise) * 0.5 + 0.5;
  
  // Create gradient for natural variation
  const cx = screenX + w / 2;
  const cy = screenY + h / 2;
  
  ctx.save();
  
  // Clip to isometric diamond
  ctx.beginPath();
  ctx.moveTo(cx, screenY);
  ctx.lineTo(screenX + w, cy);
  ctx.lineTo(cx, screenY + h);
  ctx.lineTo(screenX, cy);
  ctx.closePath();
  ctx.clip();
  
  // Base gradient from light to dark (simulating sun angle)
  const gradient = ctx.createLinearGradient(
    screenX, screenY,
    screenX + w, screenY + h
  );
  
  // Interpolate colors based on noise
  const baseHue = 95 + combinedNoise * 15;  // 95-110 (green-yellow range)
  const baseSat = 35 + combinedNoise * 20;  // 35-55%
  const baseLit = 32 + combinedNoise * 12;  // 32-44%
  
  gradient.addColorStop(0, `hsl(${baseHue}, ${baseSat}%, ${baseLit + 8}%)`);
  gradient.addColorStop(0.5, `hsl(${baseHue}, ${baseSat}%, ${baseLit}%)`);
  gradient.addColorStop(1, `hsl(${baseHue - 5}, ${baseSat - 5}%, ${baseLit - 8}%)`);
  
  ctx.fillStyle = gradient;
  ctx.fillRect(screenX - 2, screenY - 2, w + 4, h + 4);
  
  // Add dirt patches based on noise
  if (combinedNoise < 0.35) {
    const dirtAlpha = (0.35 - combinedNoise) * 2;
    ctx.fillStyle = `rgba(107, 88, 68, ${dirtAlpha * 0.4})`;
    ctx.fillRect(screenX, screenY, w, h);
  }
  
  // Add texture detail when zoomed in
  if (zoom >= 0.6) {
    // Grass blade hints
    const bladeCount = Math.floor(12 * zoom);
    ctx.strokeStyle = `rgba(90, 120, 70, 0.3)`;
    ctx.lineWidth = 0.5;
    
    for (let i = 0; i < bladeCount; i++) {
      const seed = (gridX * 31 + gridY * 17 + i * 7) % 1000;
      const bx = screenX + w * 0.2 + (seed % 100) / 100 * w * 0.6;
      const by = screenY + h * 0.2 + ((seed * 3) % 100) / 100 * h * 0.6;
      const angle = ((seed * 7) % 60 - 30) * Math.PI / 180;
      const len = 2 + (seed % 3);
      
      // Wind animation
      const windOffset = getWindNoise()(gridX * 0.1 + time * 0.5, gridY * 0.1) * 0.15;
      
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + Math.sin(angle + windOffset) * len, by - len);
      ctx.stroke();
    }
    
    // Subtle ambient occlusion at edges
    const aoGradient = ctx.createRadialGradient(cx, cy, w * 0.2, cx, cy, w * 0.6);
    aoGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    aoGradient.addColorStop(1, 'rgba(0, 0, 0, 0.08)');
    ctx.fillStyle = aoGradient;
    ctx.fillRect(screenX, screenY, w, h);
  }
  
  ctx.restore();
  
  // Draw subtle grid lines when zoomed in
  if (zoom >= 0.7) {
    ctx.strokeStyle = 'rgba(45, 74, 38, 0.2)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(cx, screenY);
    ctx.lineTo(screenX + w, cy);
    ctx.lineTo(cx, screenY + h);
    ctx.lineTo(screenX, cy);
    ctx.closePath();
    ctx.stroke();
  }
  
  // Territory ownership tint (subtle)
  if (playerColor) {
    ctx.fillStyle = playerColor + '18'; // Very subtle
    ctx.beginPath();
    ctx.moveTo(cx, screenY);
    ctx.lineTo(screenX + w, cy);
    ctx.lineTo(cx, screenY + h);
    ctx.lineTo(screenX, cy);
    ctx.closePath();
    ctx.fill();
  }
}

// ============================================================================
// ENHANCED WATER RENDERING
// ============================================================================

/**
 * Draw realistic water tile with depth, waves, and transparency
 */
export function drawEnhancedWaterTile(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  adjacentWater: { north: boolean; east: boolean; south: boolean; west: boolean },
  options: {
    time?: number;
    zoom?: number;
    depth?: number;  // 0 = shallow, 1 = deep
  } = {}
): void {
  const { time = 0, zoom = 1, depth: depthOverride } = options;
  const wNoise = getWaterNoise();
  
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = screenX + w / 2;
  const cy = screenY + h / 2;
  
  // Calculate depth based on distance from shore
  const adjacentCount = [adjacentWater.north, adjacentWater.east, adjacentWater.south, adjacentWater.west]
    .filter(Boolean).length;
  const naturalDepth = adjacentCount / 4;  // More surrounded = deeper
  const depth = depthOverride ?? (0.3 + naturalDepth * 0.7);
  
  ctx.save();
  
  // Clip to isometric diamond
  ctx.beginPath();
  ctx.moveTo(cx, screenY);
  ctx.lineTo(screenX + w, cy);
  ctx.lineTo(cx, screenY + h);
  ctx.lineTo(screenX, cy);
  ctx.closePath();
  ctx.clip();
  
  // Base water color - interpolate based on depth
  const deepColor = REALISTIC_COLORS.water.deep;
  const shallowColor = REALISTIC_COLORS.water.shallow;
  
  // Parse colors for interpolation
  const deep = hexToRgb(deepColor);
  const shallow = hexToRgb(shallowColor);
  const baseR = Math.round(shallow.r + (deep.r - shallow.r) * depth);
  const baseG = Math.round(shallow.g + (deep.g - shallow.g) * depth);
  const baseB = Math.round(shallow.b + (deep.b - shallow.b) * depth);
  
  // Create depth gradient
  const gradient = ctx.createLinearGradient(screenX, screenY, screenX + w, screenY + h);
  gradient.addColorStop(0, `rgb(${baseR + 20}, ${baseG + 20}, ${baseB + 15})`);
  gradient.addColorStop(0.5, `rgb(${baseR}, ${baseG}, ${baseB})`);
  gradient.addColorStop(1, `rgb(${baseR - 15}, ${baseG - 10}, ${baseB - 5})`);
  
  ctx.fillStyle = gradient;
  ctx.fillRect(screenX - 2, screenY - 2, w + 4, h + 4);
  
  // Animated wave patterns
  const wavePhase = time * 0.8;
  const waveNoise1 = wNoise(gridX * 0.3 + wavePhase, gridY * 0.3) * 0.5 + 0.5;
  const waveNoise2 = wNoise(gridX * 0.2 - wavePhase * 0.7, gridY * 0.2 + wavePhase * 0.3) * 0.5 + 0.5;
  
  // Draw wave highlights
  if (zoom >= 0.5) {
    ctx.strokeStyle = `rgba(138, 188, 210, ${0.15 + waveNoise1 * 0.1})`;
    ctx.lineWidth = 1;
    
    // Wave lines
    const waveCount = Math.floor(4 * zoom);
    for (let i = 0; i < waveCount; i++) {
      const waveY = screenY + h * 0.2 + i * (h * 0.2);
      const waveOffset = Math.sin(wavePhase + i * 0.5 + gridX * 0.3) * 3;
      
      ctx.beginPath();
      ctx.moveTo(screenX + w * 0.1, waveY + waveOffset);
      ctx.quadraticCurveTo(
        cx, waveY + waveOffset + Math.sin(wavePhase + i) * 2,
        screenX + w * 0.9, waveY + waveOffset - Math.sin(wavePhase + i + 1) * 2
      );
      ctx.stroke();
    }
    
    // Surface sparkles
    if (zoom >= 0.8) {
      const sparkleCount = Math.floor(5 * zoom);
      ctx.fillStyle = `rgba(255, 255, 255, ${0.3 + waveNoise2 * 0.2})`;
      
      for (let i = 0; i < sparkleCount; i++) {
        const seed = (gridX * 17 + gridY * 31 + i * 11) % 1000;
        const sx = screenX + w * 0.15 + (seed % 100) / 100 * w * 0.7;
        const sy = screenY + h * 0.15 + ((seed * 3) % 100) / 100 * h * 0.7;
        const sparklePhase = Math.sin(time * 3 + seed * 0.1);
        
        if (sparklePhase > 0.7) {
          const size = 1 + sparklePhase * 1.5;
          ctx.beginPath();
          ctx.arc(sx, sy, size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }
  
  // Subtle reflection
  const reflectionGradient = ctx.createLinearGradient(screenX, screenY, screenX, screenY + h * 0.5);
  reflectionGradient.addColorStop(0, 'rgba(122, 196, 224, 0.08)');
  reflectionGradient.addColorStop(1, 'rgba(122, 196, 224, 0)');
  ctx.fillStyle = reflectionGradient;
  ctx.fillRect(screenX, screenY, w, h);
  
  ctx.restore();
}

// ============================================================================
// ENHANCED BEACH RENDERING
// ============================================================================

/**
 * Draw realistic beach/shoreline with wet/dry gradients and foam
 */
export function drawEnhancedBeach(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  adjacentLand: { north: boolean; east: boolean; south: boolean; west: boolean },
  options: {
    time?: number;
    zoom?: number;
  } = {}
): void {
  const { time = 0, zoom = 1 } = options;
  const { north, east, south, west } = adjacentLand;
  
  if (!north && !east && !south && !west) return;
  
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = screenX + w / 2;
  const cy = screenY + h / 2;
  
  // Beach width (slightly wider than before)
  const beachWidth = w * 0.12;
  
  // Diamond corners
  const corners = {
    top: { x: cx, y: screenY },
    right: { x: screenX + w, y: cy },
    bottom: { x: cx, y: screenY + h },
    left: { x: screenX, y: cy },
  };
  
  // Draw beach for each adjacent land edge
  const edges: Array<{
    from: typeof corners.top;
    to: typeof corners.top;
    inward: { dx: number; dy: number };
    active: boolean;
  }> = [
    { from: corners.left, to: corners.top, inward: { dx: 0.707, dy: 0.707 }, active: north },
    { from: corners.top, to: corners.right, inward: { dx: -0.707, dy: 0.707 }, active: east },
    { from: corners.right, to: corners.bottom, inward: { dx: -0.707, dy: -0.707 }, active: south },
    { from: corners.bottom, to: corners.left, inward: { dx: 0.707, dy: -0.707 }, active: west },
  ];
  
  for (const edge of edges) {
    if (!edge.active) continue;
    
    const { from, to, inward } = edge;
    
    // Create gradient from dry sand (outer) to wet sand (inner)
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2;
    
    const sandGradient = ctx.createLinearGradient(
      midX, midY,
      midX + inward.dx * beachWidth, midY + inward.dy * beachWidth
    );
    sandGradient.addColorStop(0, REALISTIC_COLORS.beach.dry);
    sandGradient.addColorStop(0.6, REALISTIC_COLORS.beach.wet);
    sandGradient.addColorStop(1, REALISTIC_COLORS.beach.dark);
    
    ctx.fillStyle = sandGradient;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.lineTo(to.x + inward.dx * beachWidth, to.y + inward.dy * beachWidth);
    ctx.lineTo(from.x + inward.dx * beachWidth, from.y + inward.dy * beachWidth);
    ctx.closePath();
    ctx.fill();
    
    // Animated foam line at water edge
    if (zoom >= 0.6) {
      const foamPhase = Math.sin(time * 2 + midX * 0.1) * 0.5 + 0.5;
      const foamAlpha = 0.4 + foamPhase * 0.3;
      
      ctx.strokeStyle = `rgba(212, 232, 240, ${foamAlpha})`;
      ctx.lineWidth = 1.5 + foamPhase;
      ctx.beginPath();
      ctx.moveTo(
        from.x + inward.dx * beachWidth * 0.9,
        from.y + inward.dy * beachWidth * 0.9
      );
      ctx.lineTo(
        to.x + inward.dx * beachWidth * 0.9,
        to.y + inward.dy * beachWidth * 0.9
      );
      ctx.stroke();
    }
  }
}

// ============================================================================
// ENHANCED MOUNTAIN RENDERING
// ============================================================================

/**
 * Draw realistic mountain terrain with snow caps and ore deposits
 */
export function drawEnhancedMountain(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  options: {
    zoom?: number;
    time?: number;
    showOre?: boolean;
  } = {}
): void {
  const { zoom = 1, time = 0, showOre = true } = options;
  const noise = getTerrainNoise();
  
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = screenX + w / 2;
  const cy = screenY + h / 2;
  
  // Seed for deterministic randomness
  const seed = gridX * 1000 + gridY;
  
  ctx.save();
  
  // Clip to diamond
  ctx.beginPath();
  ctx.moveTo(cx, screenY);
  ctx.lineTo(screenX + w, cy);
  ctx.lineTo(cx, screenY + h);
  ctx.lineTo(screenX, cy);
  ctx.closePath();
  ctx.clip();
  
  // Base rocky ground gradient
  const baseGradient = ctx.createLinearGradient(screenX, screenY, screenX + w, screenY + h);
  baseGradient.addColorStop(0, REALISTIC_COLORS.mountain.light);
  baseGradient.addColorStop(0.5, REALISTIC_COLORS.mountain.base);
  baseGradient.addColorStop(1, REALISTIC_COLORS.mountain.shadow);
  
  ctx.fillStyle = baseGradient;
  ctx.fillRect(screenX - 2, screenY - 2, w + 4, h + 4);
  
  ctx.restore();
  
  // Mountain peaks (6-8 per tile)
  const numPeaks = 6 + (seed % 3);
  const peakPositions = [
    { dx: 0.5, dy: 0.25, size: 1.4, height: 1.3 },
    { dx: 0.32, dy: 0.32, size: 1.15, height: 1.1 },
    { dx: 0.68, dy: 0.32, size: 1.2, height: 1.15 },
    { dx: 0.4, dy: 0.45, size: 1.0, height: 0.9 },
    { dx: 0.6, dy: 0.45, size: 1.05, height: 0.95 },
    { dx: 0.5, dy: 0.55, size: 0.85, height: 0.8 },
    { dx: 0.3, dy: 0.52, size: 0.7, height: 0.65 },
    { dx: 0.7, dy: 0.5, size: 0.75, height: 0.7 },
  ];
  
  for (let i = 0; i < Math.min(numPeaks, peakPositions.length); i++) {
    const pos = peakPositions[i];
    const peakSeed = seed * 7 + i * 13;
    
    const baseX = screenX + w * pos.dx + ((peakSeed % 5) - 2.5) * 0.5;
    const baseY = screenY + h * pos.dy + ((peakSeed * 3 % 4) - 2) * 0.3;
    const peakWidth = (13 + (peakSeed % 5)) * pos.size;
    const peakHeight = (15 + (peakSeed * 2 % 8)) * pos.height;
    const peakX = baseX + ((peakSeed % 3) - 1) * 0.5;
    const peakY = baseY - peakHeight;
    
    // Shadow face (left)
    ctx.fillStyle = REALISTIC_COLORS.mountain.shadow;
    ctx.beginPath();
    ctx.moveTo(peakX, peakY);
    ctx.lineTo(baseX - peakWidth * 0.5, baseY);
    ctx.lineTo(baseX, baseY);
    ctx.closePath();
    ctx.fill();
    
    // Lit face (right)
    ctx.fillStyle = REALISTIC_COLORS.mountain.light;
    ctx.beginPath();
    ctx.moveTo(peakX, peakY);
    ctx.lineTo(baseX, baseY);
    ctx.lineTo(baseX + peakWidth * 0.5, baseY);
    ctx.closePath();
    ctx.fill();
    
    // Ridge line
    ctx.strokeStyle = REALISTIC_COLORS.mountain.shadow;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(peakX, peakY);
    ctx.lineTo(baseX, baseY);
    ctx.stroke();
    
    // Snow cap on taller peaks
    if (pos.height >= 1.0) {
      const snowHeight = peakHeight * 0.3;
      
      // Snow shadow
      ctx.fillStyle = REALISTIC_COLORS.mountain.snowShadow;
      ctx.beginPath();
      ctx.moveTo(peakX, peakY);
      ctx.lineTo(peakX - peakWidth * 0.12, peakY + snowHeight);
      ctx.lineTo(peakX, peakY + snowHeight * 0.8);
      ctx.closePath();
      ctx.fill();
      
      // Snow highlight
      ctx.fillStyle = REALISTIC_COLORS.mountain.snow;
      ctx.beginPath();
      ctx.moveTo(peakX, peakY);
      ctx.lineTo(peakX, peakY + snowHeight * 0.8);
      ctx.lineTo(peakX + peakWidth * 0.12, peakY + snowHeight);
      ctx.closePath();
      ctx.fill();
    }
  }
  
  // Ore deposits and boulders
  if (showOre && zoom >= 0.6) {
    const numOre = 4 + (seed % 3);
    for (let i = 0; i < numOre; i++) {
      const oreSeed = seed * 11 + i * 17;
      const ox = screenX + w * 0.25 + (oreSeed % 50) / 100 * w * 0.5;
      const oy = screenY + h * 0.65 + (oreSeed * 2 % 20) / 100 * h * 0.25;
      const oreSize = 2 + (oreSeed % 2);
      
      // Ore deposit
      ctx.fillStyle = REALISTIC_COLORS.mountain.ore;
      ctx.beginPath();
      ctx.moveTo(ox, oy - oreSize);
      ctx.lineTo(ox + oreSize, oy);
      ctx.lineTo(ox, oy + oreSize);
      ctx.lineTo(ox - oreSize, oy);
      ctx.closePath();
      ctx.fill();
      
      // Metallic glint (animated)
      const glintPhase = Math.sin(time * 2 + oreSeed * 0.5);
      if (glintPhase > 0.6) {
        ctx.fillStyle = REALISTIC_COLORS.mountain.oreGlint;
        ctx.beginPath();
        ctx.arc(ox - oreSize * 0.3, oy - oreSize * 0.3, 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    
    // Boulders at base
    const numBoulders = 5 + (seed % 4);
    for (let i = 0; i < numBoulders; i++) {
      const bSeed = seed * 19 + i * 23;
      const bx = screenX + w * 0.2 + (bSeed % 60) / 100 * w * 0.6;
      const by = screenY + h * 0.6 + (bSeed * 3 % 30) / 100 * h * 0.3;
      const bSize = 2 + (bSeed % 3);
      
      ctx.fillStyle = REALISTIC_COLORS.mountain.base;
      ctx.beginPath();
      ctx.arc(bx, by, bSize, 0, Math.PI * 2);
      ctx.fill();
      
      // Highlight
      ctx.fillStyle = REALISTIC_COLORS.mountain.light;
      ctx.beginPath();
      ctx.arc(bx - bSize * 0.3, by - bSize * 0.3, bSize * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ============================================================================
// ENHANCED FOREST RENDERING
// ============================================================================

/**
 * Draw realistic forest with layered trees and wind animation
 */
export function drawEnhancedForest(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  density: number,  // 0-100
  options: {
    zoom?: number;
    time?: number;
    treeSprite?: HTMLImageElement | null;
  } = {}
): void {
  const { zoom = 1, time = 0, treeSprite } = options;
  const wind = getWindNoise();
  
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const seed = gridX * 31 + gridY * 17;
  
  // Draw forest floor first
  drawEnhancedGroundTile(ctx, screenX, screenY, gridX, gridY, { zoom, time });
  
  // Dark undergrowth tint
  const cx = screenX + w / 2;
  const cy = screenY + h / 2;
  
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx, screenY);
  ctx.lineTo(screenX + w, cy);
  ctx.lineTo(cx, screenY + h);
  ctx.lineTo(screenX, cy);
  ctx.closePath();
  ctx.clip();
  
  ctx.fillStyle = 'rgba(42, 74, 42, 0.25)';
  ctx.fillRect(screenX, screenY, w, h);
  ctx.restore();
  
  // Number of trees based on density
  const numTrees = Math.floor(4 + (density / 100) * 4);
  
  // Tree positions within tile
  const treePositions = [
    { dx: 0.5, dy: 0.3, scale: 1.0 },
    { dx: 0.28, dy: 0.42, scale: 0.9 },
    { dx: 0.72, dy: 0.42, scale: 0.85 },
    { dx: 0.22, dy: 0.55, scale: 0.75 },
    { dx: 0.5, dy: 0.52, scale: 0.8 },
    { dx: 0.78, dy: 0.55, scale: 0.7 },
    { dx: 0.35, dy: 0.65, scale: 0.65 },
    { dx: 0.65, dy: 0.65, scale: 0.6 },
  ];
  
  for (let i = 0; i < Math.min(numTrees, treePositions.length); i++) {
    const pos = treePositions[i];
    const treeSeed = seed * 7 + i * 11;
    
    // Position with slight randomness
    const tx = screenX + w * pos.dx + ((treeSeed % 10) - 5) * 0.5;
    const ty = screenY + h * pos.dy + ((treeSeed * 3 % 8) - 4) * 0.3;
    
    // Wind animation
    const windOffset = wind(gridX * 0.1 + time * 0.5, gridY * 0.1 + i * 0.5) * 0.1;
    
    // Scale variation
    const scale = pos.scale * (0.9 + (treeSeed % 20) / 100);
    const treeHeight = 18 * scale;
    const trunkHeight = 5 * scale;
    const canopyWidth = 12 * scale;
    
    // If we have a tree sprite, use it
    if (treeSprite) {
      const spriteScale = scale * 0.4;
      const destW = treeSprite.width * spriteScale;
      const destH = treeSprite.height * spriteScale;
      
      ctx.save();
      ctx.translate(tx, ty - destH * 0.8);
      ctx.rotate(windOffset);
      ctx.drawImage(treeSprite, -destW / 2, 0, destW, destH);
      ctx.restore();
    } else {
      // Draw procedural tree
      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(windOffset);
      
      // Trunk
      ctx.fillStyle = REALISTIC_COLORS.forest.trunk;
      ctx.fillRect(-1.5 * scale, -trunkHeight, 3 * scale, trunkHeight);
      
      // Canopy layers (back to front)
      const canopyColors = [
        REALISTIC_COLORS.forest.canopyDark,
        REALISTIC_COLORS.forest.canopyMid,
        REALISTIC_COLORS.forest.canopyLight,
      ];
      
      for (let layer = 0; layer < 3; layer++) {
        const layerY = -trunkHeight - (2 - layer) * 4 * scale;
        const layerWidth = canopyWidth * (0.7 + layer * 0.15);
        const layerHeight = treeHeight * 0.4 * (0.8 + layer * 0.1);
        
        ctx.fillStyle = canopyColors[layer];
        ctx.beginPath();
        ctx.moveTo(0, layerY - layerHeight);
        ctx.lineTo(layerWidth / 2, layerY);
        ctx.lineTo(-layerWidth / 2, layerY);
        ctx.closePath();
        ctx.fill();
      }
      
      // Highlight on top
      if (zoom >= 0.7) {
        ctx.fillStyle = REALISTIC_COLORS.forest.highlight;
        ctx.beginPath();
        ctx.arc(canopyWidth * 0.15, -trunkHeight - treeHeight * 0.35, 2 * scale, 0, Math.PI * 2);
        ctx.fill();
      }
      
      ctx.restore();
    }
  }
  
  // Shadow on ground under trees
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx, screenY);
  ctx.lineTo(screenX + w, cy);
  ctx.lineTo(cx, screenY + h);
  ctx.lineTo(screenX, cy);
  ctx.closePath();
  ctx.clip();
  
  ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
  ctx.beginPath();
  ctx.ellipse(cx + 3, cy + 3, w * 0.35, h * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ============================================================================
// ENHANCED OIL DEPOSIT RENDERING
// ============================================================================

/**
 * Draw realistic oil deposit with iridescent sheen
 */
export function drawEnhancedOilDeposit(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  options: {
    zoom?: number;
    time?: number;
  } = {}
): void {
  const { zoom = 1, time = 0 } = options;
  const seed = gridX * 31 + gridY * 17;
  
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = screenX + w / 2;
  const cy = screenY + h / 2;
  
  // Draw base grass first
  drawEnhancedGroundTile(ctx, screenX, screenY, gridX, gridY, { zoom, time });
  
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx, screenY);
  ctx.lineTo(screenX + w, cy);
  ctx.lineTo(cx, screenY + h);
  ctx.lineTo(screenX, cy);
  ctx.closePath();
  ctx.clip();
  
  // Generate 5-7 oil pools
  const numPools = 5 + (seed % 3);
  
  for (let i = 0; i < numPools; i++) {
    const poolSeed = seed * 7 + i * 13;
    
    const px = cx + ((poolSeed % 50) - 25) / 100 * w * 0.6;
    const py = cy + ((poolSeed * 3 % 40) - 20) / 100 * h * 0.6;
    const poolW = w * (0.08 + (poolSeed % 40) / 1000);
    const poolH = h * (0.06 + (poolSeed * 2 % 30) / 1000);
    const angle = ((poolSeed * 5) % 90 - 45) * Math.PI / 180;
    
    // Oil pool base
    ctx.fillStyle = REALISTIC_COLORS.oil.base;
    ctx.beginPath();
    ctx.ellipse(px, py, poolW, poolH, angle, 0, Math.PI * 2);
    ctx.fill();
    
    // Iridescent sheen (animated)
    const sheenPhase = time * 0.5 + poolSeed * 0.1;
    const sheenIndex = Math.floor((Math.sin(sheenPhase) * 0.5 + 0.5) * REALISTIC_COLORS.oil.rainbow.length);
    const sheenColor = REALISTIC_COLORS.oil.rainbow[sheenIndex % REALISTIC_COLORS.oil.rainbow.length];
    
    ctx.fillStyle = sheenColor;
    ctx.globalAlpha = 0.15 + Math.sin(sheenPhase * 2) * 0.05;
    ctx.beginPath();
    ctx.ellipse(px - poolW * 0.2, py - poolH * 0.2, poolW * 0.6, poolH * 0.5, angle, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    
    // Highlight
    ctx.fillStyle = REALISTIC_COLORS.oil.highlight;
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.ellipse(px - poolW * 0.3, py - poolH * 0.3, poolW * 0.25, poolH * 0.2, angle, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  
  ctx.restore();
}

// ============================================================================
// ENHANCED SKY RENDERING
// ============================================================================

/**
 * Draw atmospheric sky background with clouds
 */
export function drawEnhancedSky(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  options: {
    timeOfDay?: 'day' | 'dawn' | 'dusk' | 'night';
    time?: number;
  } = {}
): void {
  const { timeOfDay = 'day', time = 0 } = options;
  
  const w = canvas.width;
  const h = canvas.height;
  
  // Base sky gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  
  switch (timeOfDay) {
    case 'dawn':
      gradient.addColorStop(0, '#1a365d');
      gradient.addColorStop(0.3, '#4a5a7a');
      gradient.addColorStop(0.6, '#8a6a5a');
      gradient.addColorStop(1, '#2a4a3e');
      break;
    case 'dusk':
      gradient.addColorStop(0, '#2a2a4a');
      gradient.addColorStop(0.3, '#6a4a6a');
      gradient.addColorStop(0.6, '#8a5a4a');
      gradient.addColorStop(1, '#1a3a2e');
      break;
    case 'night':
      gradient.addColorStop(0, '#0a1020');
      gradient.addColorStop(0.5, '#101828');
      gradient.addColorStop(1, '#0a2018');
      break;
    default: // day
      gradient.addColorStop(0, REALISTIC_COLORS.sky.zenith);
      gradient.addColorStop(0.4, '#2a5a7e');
      gradient.addColorStop(0.7, REALISTIC_COLORS.sky.horizon);
      gradient.addColorStop(1, '#3a6a5e');
  }
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
  
  // Subtle atmospheric haze at horizon
  const hazeGradient = ctx.createLinearGradient(0, h * 0.5, 0, h);
  hazeGradient.addColorStop(0, 'rgba(180, 200, 210, 0)');
  hazeGradient.addColorStop(1, 'rgba(180, 200, 210, 0.08)');
  ctx.fillStyle = hazeGradient;
  ctx.fillRect(0, h * 0.5, w, h * 0.5);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Convert hex color to RGB
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
 * Interpolate between two colors
 */
export function lerpColor(color1: string, color2: string, t: number): string {
  const c1 = hexToRgb(color1);
  const c2 = hexToRgb(color2);
  
  const r = Math.round(c1.r + (c2.r - c1.r) * t);
  const g = Math.round(c1.g + (c2.g - c1.g) * t);
  const b = Math.round(c1.b + (c2.b - c1.b) * t);
  
  return `rgb(${r}, ${g}, ${b})`;
}

// ============================================================================
// CACHE MANAGEMENT
// ============================================================================

// Pre-computed noise values cache for performance
const noiseCache = new Map<string, number>();

/**
 * Get cached noise value for tile
 */
export function getCachedNoise(gridX: number, gridY: number, type: 'terrain' | 'grass' | 'water' = 'terrain'): number {
  const key = `${type}-${gridX}-${gridY}`;
  
  if (noiseCache.has(key)) {
    return noiseCache.get(key)!;
  }
  
  let noise: NoiseFunction2D;
  let scale: number;
  
  switch (type) {
    case 'grass':
      noise = getGrassNoise();
      scale = 0.5;
      break;
    case 'water':
      noise = getWaterNoise();
      scale = 0.3;
      break;
    default:
      noise = getTerrainNoise();
      scale = 0.15;
  }
  
  const value = noise(gridX * scale, gridY * scale) * 0.5 + 0.5;
  
  // Limit cache size
  if (noiseCache.size > 10000) {
    const firstKey = noiseCache.keys().next().value;
    if (firstKey) noiseCache.delete(firstKey);
  }
  
  noiseCache.set(key, value);
  return value;
}

/**
 * Clear noise cache (call when game resets)
 */
export function clearNoiseCache(): void {
  noiseCache.clear();
}
