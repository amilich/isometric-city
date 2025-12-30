/**
 * Rise of Nations - Enhanced Graphics System
 * 
 * High-fidelity terrain, water, lighting, and effects rendering.
 * Focus on realistic, grounded visuals - muted earth tones, proper depth,
 * and believable natural elements rather than cartoon-y gradients.
 */

import { createNoise2D, NoiseFunction2D } from 'simplex-noise';
import { TILE_WIDTH, TILE_HEIGHT } from '@/components/game/shared';

// ============================================================================
// NOISE GENERATORS (lazy initialization for performance)
// ============================================================================

let terrainNoise: NoiseFunction2D | null = null;
let grassDetailNoise: NoiseFunction2D | null = null;
let waterNoise: NoiseFunction2D | null = null;
let waveNoise: NoiseFunction2D | null = null;
let cloudNoise: NoiseFunction2D | null = null;
let forestNoise: NoiseFunction2D | null = null;

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

function getForestNoise(): NoiseFunction2D {
  if (!forestNoise) forestNoise = createNoise2D();
  return forestNoise;
}

// ============================================================================
// REALISTIC COLOR PALETTES - Earth tones, not cartoon-y
// ============================================================================

/** Realistic grass/terrain colors - muted, natural earth tones */
export const TERRAIN_COLORS = {
  // Grass variants - muted greens with earth undertones
  grassDark: { r: 76, g: 100, b: 58 },      // Dark earthy green
  grassMid: { r: 98, g: 120, b: 72 },       // Mid grass
  grassLight: { r: 122, g: 142, b: 88 },    // Light grass
  grassDry: { r: 140, g: 135, b: 85 },      // Dry/parched grass
  
  // Dirt/earth variants
  dirtDark: { r: 92, g: 72, b: 52 },        // Dark rich soil
  dirtMid: { r: 120, g: 95, b: 68 },        // Mid brown earth
  dirtLight: { r: 148, g: 120, b: 88 },     // Light sandy soil
  dirtRed: { r: 138, g: 88, b: 62 },        // Red clay
  
  // Stone/rock
  stoneDark: { r: 72, g: 75, b: 78 },
  stoneMid: { r: 112, g: 115, b: 118 },
  stoneLight: { r: 155, g: 158, b: 162 },
  
  // Grid stroke
  stroke: 'rgba(40, 50, 35, 0.15)',
};

/** Realistic water colors - deeper blues, proper depth gradient */
export const WATER_COLORS = {
  deep: { r: 28, g: 58, b: 92 },           // Deep ocean
  mid: { r: 42, g: 82, b: 120 },           // Mid water
  shallow: { r: 72, g: 115, b: 145 },      // Shallow water
  veryShallow: { r: 95, g: 140, b: 162 },  // Very shallow/coastal
  foam: { r: 225, g: 235, b: 245 },        // Wave foam
  sparkle: { r: 255, g: 255, b: 255 },     // Sun sparkle
  reflection: { r: 140, g: 175, b: 200 },  // Sky reflection
};

/** Realistic beach/sand colors */
export const BEACH_COLORS = {
  dry: { r: 218, g: 195, b: 160 },         // Dry sand
  damp: { r: 185, g: 165, b: 130 },        // Damp sand
  wet: { r: 145, g: 128, b: 98 },          // Wet sand near water
  dark: { r: 118, g: 105, b: 82 },         // Dark wet sand
  pebbles: { r: 130, g: 125, b: 115 },     // Beach pebbles
};

/** Forest colors - natural woodland tones */
export const FOREST_COLORS = {
  canopyDark: { r: 32, g: 55, b: 35 },     // Dark canopy shadow
  canopyMid: { r: 52, g: 78, b: 48 },      // Mid canopy
  canopyLight: { r: 75, g: 102, b: 62 },   // Sunlit canopy
  highlight: { r: 95, g: 125, b: 72 },     // Bright highlights
  trunk: { r: 68, g: 52, b: 38 },          // Tree trunk
  trunkDark: { r: 48, g: 38, b: 28 },      // Dark trunk/shadow
  groundShadow: { r: 45, g: 58, b: 42 },   // Forest floor shadow
};

/** Mountain/rock colors */
export const MOUNTAIN_COLORS = {
  baseDark: { r: 65, g: 62, b: 58 },       // Dark rock base
  baseMid: { r: 95, g: 90, b: 85 },        // Mid rock
  baseLight: { r: 125, g: 118, b: 112 },   // Light rock
  peak: { r: 148, g: 142, b: 138 },        // Peak color
  shadow: { r: 48, g: 45, b: 42 },         // Deep shadow
  snow: { r: 245, g: 248, b: 252 },        // Snow cap
  snowShadow: { r: 195, g: 205, b: 215 },  // Snow in shadow
  ore: { r: 165, g: 120, b: 65 },          // Ore/metal deposit
  oreGlint: { r: 220, g: 180, b: 100 },    // Ore sparkle
};

/** Oil deposit colors */
export const OIL_COLORS = {
  slick: { r: 25, g: 22, b: 18 },          // Dark oil
  sheen: { r: 45, g: 42, b: 38 },          // Oil sheen
  rainbow: { r: 90, g: 80, b: 120 },       // Iridescent effect
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/** Convert RGB object to CSS string */
function rgb(color: { r: number; g: number; b: number }, alpha = 1): string {
  return alpha === 1 
    ? `rgb(${color.r}, ${color.g}, ${color.b})`
    : `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
}

/** Linear interpolation */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

/** Interpolate between two colors */
function lerpColor(
  c1: { r: number; g: number; b: number },
  c2: { r: number; g: number; b: number },
  t: number
): { r: number; g: number; b: number } {
  return {
    r: Math.round(lerp(c1.r, c2.r, t)),
    g: Math.round(lerp(c1.g, c2.g, t)),
    b: Math.round(lerp(c1.b, c2.b, t)),
  };
}

/** Multi-octave noise for natural patterns */
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

/** Simple deterministic hash for consistent per-tile randomness */
function tileHash(x: number, y: number, seed = 0): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453;
  return n - Math.floor(n);
}

// ============================================================================
// CACHED PATTERNS FOR PERFORMANCE
// ============================================================================

const patternCache = new Map<string, CanvasPattern | null>();

/** Get or create a cached pattern */
function getCachedPattern(
  ctx: CanvasRenderingContext2D,
  key: string,
  width: number,
  height: number,
  drawFn: (pctx: CanvasRenderingContext2D) => void
): CanvasPattern | null {
  if (patternCache.has(key)) {
    return patternCache.get(key)!;
  }

  const patternCanvas = document.createElement('canvas');
  patternCanvas.width = width;
  patternCanvas.height = height;
  const pctx = patternCanvas.getContext('2d');
  if (!pctx) return null;

  drawFn(pctx);

  const pattern = ctx.createPattern(patternCanvas, 'repeat');
  patternCache.set(key, pattern);
  return pattern;
}

// ============================================================================
// ENHANCED TERRAIN RENDERING
// ============================================================================

/**
 * Draw a realistic grass/terrain tile with natural variation
 */
export function drawEnhancedGrassTile(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  zoom: number,
  options: {
    ambient?: number;
    highlight?: boolean;
    selected?: boolean;
    territoryOwner?: string | null;
    territoryColor?: string;
  } = {}
): void {
  const { ambient = 1.0, highlight = false, selected = false, territoryOwner, territoryColor } = options;
  const noise = getTerrainNoise();
  const detailNoise = getGrassDetailNoise();

  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = screenX + w / 2;
  const cy = screenY + h / 2;

  // Get procedural variation for this tile
  const terrainVal = octaveNoise(noise, gridX * 0.15, gridY * 0.15, 3, 0.5, 0.1);
  const detailVal = octaveNoise(detailNoise, gridX * 0.4, gridY * 0.4, 2, 0.6, 0.2);
  const patchVal = tileHash(gridX, gridY);
  
  // Determine grass/dirt mix based on noise
  // Most tiles are grass, some have dirt patches
  const dirtAmount = Math.max(0, terrainVal * 0.5 + patchVal * 0.2 - 0.3);
  const isDryPatch = patchVal > 0.85;
  
  // Base grass color with variation
  let baseColor: { r: number; g: number; b: number };
  if (isDryPatch) {
    baseColor = lerpColor(TERRAIN_COLORS.grassMid, TERRAIN_COLORS.grassDry, patchVal - 0.85);
  } else {
    const grassT = (terrainVal + 1) / 2;
    baseColor = lerpColor(TERRAIN_COLORS.grassDark, TERRAIN_COLORS.grassLight, grassT);
  }
  
  // Mix in dirt for variation
  if (dirtAmount > 0.1) {
    const dirtT = (detailVal + 1) / 2;
    const dirtColor = lerpColor(TERRAIN_COLORS.dirtDark, TERRAIN_COLORS.dirtLight, dirtT);
    baseColor = lerpColor(baseColor, dirtColor, Math.min(dirtAmount * 0.4, 0.3));
  }
  
  // Apply ambient lighting
  const litColor = {
    r: Math.round(baseColor.r * ambient),
    g: Math.round(baseColor.g * ambient),
    b: Math.round(baseColor.b * ambient),
  };

  // Draw base tile
  ctx.fillStyle = rgb(litColor);
  ctx.beginPath();
  ctx.moveTo(cx, screenY);
  ctx.lineTo(screenX + w, cy);
  ctx.lineTo(cx, screenY + h);
  ctx.lineTo(screenX, cy);
  ctx.closePath();
  ctx.fill();

  // Add subtle texture variation when zoomed in
  if (zoom >= 0.5) {
    ctx.save();
    // Clip to tile
    ctx.beginPath();
    ctx.moveTo(cx, screenY);
    ctx.lineTo(screenX + w, cy);
    ctx.lineTo(cx, screenY + h);
    ctx.lineTo(screenX, cy);
    ctx.closePath();
    ctx.clip();

    // Draw subtle grass texture strokes
    const numStrokes = zoom >= 0.8 ? 6 : 3;
    for (let i = 0; i < numStrokes; i++) {
      const hash = tileHash(gridX, gridY, i * 7);
      const hash2 = tileHash(gridX + 1, gridY + 1, i * 11);
      
      const offsetX = (hash - 0.5) * w * 0.8;
      const offsetY = (hash2 - 0.5) * h * 0.8;
      const strokeX = cx + offsetX;
      const strokeY = cy + offsetY;
      
      // Subtle variation in stroke color
      const strokeBrightness = 0.85 + hash * 0.3;
      const strokeColor = {
        r: Math.min(255, Math.round(litColor.r * strokeBrightness)),
        g: Math.min(255, Math.round(litColor.g * strokeBrightness)),
        b: Math.min(255, Math.round(litColor.b * strokeBrightness)),
      };
      
      ctx.strokeStyle = rgb(strokeColor, 0.4);
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(strokeX, strokeY);
      ctx.lineTo(strokeX + (hash - 0.5) * 2, strokeY - 1.5 - hash * 1.5);
      ctx.stroke();
    }

    ctx.restore();
  }

  // Draw subtle grid line
  if (zoom >= 0.6) {
    ctx.strokeStyle = TERRAIN_COLORS.stroke;
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    ctx.moveTo(cx, screenY);
    ctx.lineTo(screenX + w, cy);
    ctx.lineTo(cx, screenY + h);
    ctx.lineTo(screenX, cy);
    ctx.closePath();
    ctx.stroke();
  }

  // Territory overlay
  if (territoryOwner && territoryColor) {
    ctx.fillStyle = territoryColor;
    ctx.beginPath();
    ctx.moveTo(cx, screenY);
    ctx.lineTo(screenX + w, cy);
    ctx.lineTo(cx, screenY + h);
    ctx.lineTo(screenX, cy);
    ctx.closePath();
    ctx.fill();
  }

  // Highlight/selection
  if (highlight || selected) {
    ctx.fillStyle = selected 
      ? 'rgba(34, 197, 94, 0.25)' 
      : 'rgba(255, 255, 255, 0.12)';
    ctx.beginPath();
    ctx.moveTo(cx, screenY);
    ctx.lineTo(screenX + w, cy);
    ctx.lineTo(cx, screenY + h);
    ctx.lineTo(screenX, cy);
    ctx.closePath();
    ctx.fill();
    
    ctx.strokeStyle = selected ? '#22c55e' : 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = selected ? 2 : 1;
    ctx.stroke();
  }
}

// ============================================================================
// ENHANCED WATER RENDERING
// ============================================================================

/**
 * Draw realistic water with depth-based color, animated waves, and reflections
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

  // Calculate depth based on adjacent water tiles
  const numAdjacentWater = [adjacentWater.north, adjacentWater.east, adjacentWater.south, adjacentWater.west]
    .filter(Boolean).length;
  const depth = numAdjacentWater / 4; // 0 = edge, 1 = surrounded

  // Select water color based on depth
  let waterColor: { r: number; g: number; b: number };
  if (depth < 0.25) {
    waterColor = lerpColor(WATER_COLORS.veryShallow, WATER_COLORS.shallow, depth * 4);
  } else if (depth < 0.5) {
    waterColor = lerpColor(WATER_COLORS.shallow, WATER_COLORS.mid, (depth - 0.25) * 4);
  } else {
    waterColor = lerpColor(WATER_COLORS.mid, WATER_COLORS.deep, (depth - 0.5) * 2);
  }

  // Apply ambient lighting
  waterColor = {
    r: Math.round(waterColor.r * ambient),
    g: Math.round(waterColor.g * ambient),
    b: Math.round(waterColor.b * ambient),
  };

  // Draw base water
  ctx.fillStyle = rgb(waterColor);
  ctx.beginPath();
  ctx.moveTo(cx, screenY);
  ctx.lineTo(screenX + w, cy);
  ctx.lineTo(cx, screenY + h);
  ctx.lineTo(screenX, cy);
  ctx.closePath();
  ctx.fill();

  // Add wave effects
  const waveTime = animTime * 0.8;
  const waveNoise = waveNoiseFn(gridX * 0.3 + waveTime * 0.5, gridY * 0.3);
  const waveIntensity = 0.15 + waveNoise * 0.1;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx, screenY);
  ctx.lineTo(screenX + w, cy);
  ctx.lineTo(cx, screenY + h);
  ctx.lineTo(screenX, cy);
  ctx.closePath();
  ctx.clip();

  // Draw subtle wave lines
  if (zoom >= 0.4) {
    const numWaves = 3;
    for (let i = 0; i < numWaves; i++) {
      const waveOffset = (animTime * 0.5 + i * 0.3) % 1;
      const waveY = screenY + h * (0.2 + i * 0.25 + waveOffset * 0.15);
      const waveAmp = 2 + Math.sin(animTime * 2 + i) * 1;
      
      // Wave highlight
      ctx.strokeStyle = rgb(WATER_COLORS.reflection, 0.15 + waveIntensity * 0.1);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(screenX + w * 0.15, waveY);
      ctx.quadraticCurveTo(
        cx, waveY + waveAmp * Math.sin(animTime * 3 + i),
        screenX + w * 0.85, waveY
      );
      ctx.stroke();
    }
  }

  // Add sun sparkles on shallow water
  if (sparkle && depth < 0.6 && zoom >= 0.5) {
    const sparklePhase = animTime * 2;
    const numSparkles = Math.floor(2 + depth * 3);
    
    for (let i = 0; i < numSparkles; i++) {
      const hash = tileHash(gridX, gridY, i * 13);
      const hash2 = tileHash(gridX + 1, gridY, i * 17);
      const sparkleActive = Math.sin(sparklePhase + hash * Math.PI * 2) > 0.7;
      
      if (sparkleActive) {
        const sparkleX = cx + (hash - 0.5) * w * 0.6;
        const sparkleY = cy + (hash2 - 0.5) * h * 0.6;
        const sparkleSize = 1 + hash * 1.5;
        const sparkleAlpha = 0.3 + Math.sin(sparklePhase * 3 + hash * 10) * 0.2;
        
        ctx.fillStyle = rgb(WATER_COLORS.sparkle, sparkleAlpha);
        ctx.beginPath();
        ctx.arc(sparkleX, sparkleY, sparkleSize, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  ctx.restore();

  // Subtle border for depth perception
  if (zoom >= 0.6 && depth < 0.75) {
    ctx.strokeStyle = rgb(WATER_COLORS.deep, 0.15);
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

// ============================================================================
// ENHANCED BEACH RENDERING
// ============================================================================

/**
 * Draw realistic beach transition on a water tile near land
 */
export function drawEnhancedBeach(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  animTime: number,
  zoom: number,
  adjacentLand: { north: boolean; east: boolean; south: boolean; west: boolean },
  options: {
    ambient?: number;
  } = {}
): void {
  const { ambient = 1.0 } = options;
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = screenX + w / 2;
  const cy = screenY + h / 2;

  const landDirections = Object.entries(adjacentLand)
    .filter(([, hasLand]) => hasLand)
    .map(([dir]) => dir);

  if (landDirections.length === 0) return;

  ctx.save();
  
  // Clip to tile
  ctx.beginPath();
  ctx.moveTo(cx, screenY);
  ctx.lineTo(screenX + w, cy);
  ctx.lineTo(cx, screenY + h);
  ctx.lineTo(screenX, cy);
  ctx.closePath();
  ctx.clip();

  // Draw beach/sand gradient from each land direction
  for (const dir of landDirections) {
    let gradientStart: { x: number; y: number };
    let gradientEnd: { x: number; y: number };
    
    switch (dir) {
      case 'north':
        gradientStart = { x: screenX + w * 0.25, y: screenY + h * 0.25 };
        gradientEnd = { x: cx, y: cy };
        break;
      case 'east':
        gradientStart = { x: screenX + w * 0.75, y: screenY + h * 0.25 };
        gradientEnd = { x: cx, y: cy };
        break;
      case 'south':
        gradientStart = { x: screenX + w * 0.75, y: screenY + h * 0.75 };
        gradientEnd = { x: cx, y: cy };
        break;
      case 'west':
        gradientStart = { x: screenX + w * 0.25, y: screenY + h * 0.75 };
        gradientEnd = { x: cx, y: cy };
        break;
      default:
        continue;
    }

    // Create sand gradient
    const sandGradient = ctx.createLinearGradient(
      gradientStart.x, gradientStart.y,
      gradientEnd.x, gradientEnd.y
    );

    const dryColor = {
      r: Math.round(BEACH_COLORS.dry.r * ambient),
      g: Math.round(BEACH_COLORS.dry.g * ambient),
      b: Math.round(BEACH_COLORS.dry.b * ambient),
    };
    const wetColor = {
      r: Math.round(BEACH_COLORS.wet.r * ambient),
      g: Math.round(BEACH_COLORS.wet.g * ambient),
      b: Math.round(BEACH_COLORS.wet.b * ambient),
    };

    sandGradient.addColorStop(0, rgb(dryColor, 0.85));
    sandGradient.addColorStop(0.4, rgb(wetColor, 0.6));
    sandGradient.addColorStop(0.7, rgb(wetColor, 0.25));
    sandGradient.addColorStop(1, 'transparent');

    ctx.fillStyle = sandGradient;
    ctx.fillRect(screenX - 2, screenY - 2, w + 4, h + 4);
  }

  // Draw foam line animation
  if (zoom >= 0.5) {
    const foamPhase = animTime * 0.6;
    
    for (const dir of landDirections) {
      const foamOffset = Math.sin(foamPhase + tileHash(gridX, gridY, dir.charCodeAt(0)) * Math.PI * 2) * 0.15;
      
      let foamStart: { x: number; y: number };
      let foamEnd: { x: number; y: number };
      let foamMid: { x: number; y: number };
      
      const edgeOffset = 0.35 + foamOffset;
      
      switch (dir) {
        case 'north':
          foamStart = { x: screenX + w * 0.1, y: screenY + h * edgeOffset };
          foamEnd = { x: screenX + w * 0.4, y: screenY + h * (edgeOffset - 0.1) };
          foamMid = { x: screenX + w * 0.25, y: screenY + h * (edgeOffset - 0.02) };
          break;
        case 'east':
          foamStart = { x: screenX + w * (1 - edgeOffset), y: screenY + h * 0.1 };
          foamEnd = { x: screenX + w * (1 - edgeOffset + 0.1), y: screenY + h * 0.4 };
          foamMid = { x: screenX + w * (1 - edgeOffset + 0.02), y: screenY + h * 0.25 };
          break;
        case 'south':
          foamStart = { x: screenX + w * 0.6, y: screenY + h * (1 - edgeOffset + 0.1) };
          foamEnd = { x: screenX + w * 0.9, y: screenY + h * (1 - edgeOffset) };
          foamMid = { x: screenX + w * 0.75, y: screenY + h * (1 - edgeOffset + 0.02) };
          break;
        case 'west':
          foamStart = { x: screenX + w * (edgeOffset - 0.1), y: screenY + h * 0.6 };
          foamEnd = { x: screenX + w * edgeOffset, y: screenY + h * 0.9 };
          foamMid = { x: screenX + w * (edgeOffset - 0.02), y: screenY + h * 0.75 };
          break;
        default:
          continue;
      }

      // Draw foam line
      const foamAlpha = 0.4 + Math.sin(foamPhase * 2) * 0.15;
      ctx.strokeStyle = rgb(BEACH_COLORS.dry, foamAlpha);
      ctx.lineWidth = 1.5 + Math.sin(foamPhase * 1.5) * 0.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(foamStart.x, foamStart.y);
      ctx.quadraticCurveTo(foamMid.x, foamMid.y, foamEnd.x, foamEnd.y);
      ctx.stroke();
    }
  }

  ctx.restore();
}

// ============================================================================
// ENHANCED FOREST RENDERING
// ============================================================================

/**
 * Draw realistic procedural forest on a tile
 */
export function drawEnhancedForest(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  density: number,
  animTime: number,
  zoom: number,
  options: {
    ambient?: number;
  } = {}
): void {
  const { ambient = 1.0 } = options;
  const forestNoiseFn = getForestNoise();
  
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = screenX + w / 2;
  const cy = screenY + h / 2;

  // Draw forest floor shadow first
  const shadowColor = {
    r: Math.round(FOREST_COLORS.groundShadow.r * ambient),
    g: Math.round(FOREST_COLORS.groundShadow.g * ambient),
    b: Math.round(FOREST_COLORS.groundShadow.b * ambient),
  };
  
  ctx.fillStyle = rgb(shadowColor);
  ctx.beginPath();
  ctx.moveTo(cx, screenY);
  ctx.lineTo(screenX + w, cy);
  ctx.lineTo(cx, screenY + h);
  ctx.lineTo(screenX, cy);
  ctx.closePath();
  ctx.fill();

  // Number of trees based on density
  const numTrees = Math.floor(2 + density * 4);
  
  // Wind sway animation
  const windPhase = animTime * 0.5;
  const windStrength = 0.02 + forestNoiseFn(animTime * 0.1, 0) * 0.01;

  ctx.save();
  
  // Clip to tile area
  ctx.beginPath();
  ctx.moveTo(cx, screenY - h * 0.5);
  ctx.lineTo(screenX + w + w * 0.2, cy);
  ctx.lineTo(cx, screenY + h * 1.2);
  ctx.lineTo(screenX - w * 0.2, cy);
  ctx.closePath();
  ctx.clip();

  // Draw trees from back to front
  const trees: { x: number; y: number; size: number; hash: number }[] = [];
  
  for (let i = 0; i < numTrees; i++) {
    const hash = tileHash(gridX, gridY, i * 7);
    const hash2 = tileHash(gridX + i, gridY + 1, i * 11);
    
    const treeX = cx + (hash - 0.5) * w * 0.7;
    const treeY = cy + (hash2 - 0.5) * h * 0.6 - 5;
    const treeSize = (0.6 + hash * 0.5) * (zoom >= 0.6 ? 1 : 0.8);
    
    trees.push({ x: treeX, y: treeY, size: treeSize, hash });
  }
  
  // Sort by Y position (back to front)
  trees.sort((a, b) => a.y - b.y);

  for (const tree of trees) {
    const { x: treeX, y: treeY, size, hash } = tree;
    
    // Wind sway for this tree
    const treeSway = Math.sin(windPhase + hash * Math.PI * 4) * windStrength * size * 20;
    
    // Tree trunk
    const trunkColor = {
      r: Math.round(FOREST_COLORS.trunk.r * ambient),
      g: Math.round(FOREST_COLORS.trunk.g * ambient),
      b: Math.round(FOREST_COLORS.trunk.b * ambient),
    };
    
    ctx.fillStyle = rgb(trunkColor);
    ctx.beginPath();
    ctx.moveTo(treeX - 1.5 * size, treeY);
    ctx.lineTo(treeX - 1 * size + treeSway * 0.3, treeY - 8 * size);
    ctx.lineTo(treeX + 1 * size + treeSway * 0.3, treeY - 8 * size);
    ctx.lineTo(treeX + 1.5 * size, treeY);
    ctx.closePath();
    ctx.fill();

    // Tree canopy (layered triangles)
    const canopyLayers = 3;
    for (let layer = 0; layer < canopyLayers; layer++) {
      const layerOffset = layer * 5 * size;
      const layerWidth = (8 - layer * 1.5) * size;
      const layerHeight = 6 * size;
      
      // Vary color by layer
      const colorT = layer / canopyLayers;
      const canopyColor = lerpColor(FOREST_COLORS.canopyDark, FOREST_COLORS.canopyLight, colorT);
      const litCanopy = {
        r: Math.round(canopyColor.r * ambient),
        g: Math.round(canopyColor.g * ambient),
        b: Math.round(canopyColor.b * ambient),
      };
      
      const layerCenterY = treeY - 10 * size - layerOffset + treeSway * (1 + layer * 0.3);
      const layerCenterX = treeX + treeSway * (1 + layer * 0.5);
      
      ctx.fillStyle = rgb(litCanopy);
      ctx.beginPath();
      ctx.moveTo(layerCenterX, layerCenterY - layerHeight);
      ctx.lineTo(layerCenterX + layerWidth / 2, layerCenterY);
      ctx.lineTo(layerCenterX - layerWidth / 2, layerCenterY);
      ctx.closePath();
      ctx.fill();
      
      // Highlight on right side
      if (zoom >= 0.6) {
        const highlightColor = {
          r: Math.round(FOREST_COLORS.highlight.r * ambient),
          g: Math.round(FOREST_COLORS.highlight.g * ambient),
          b: Math.round(FOREST_COLORS.highlight.b * ambient),
        };
        
        ctx.fillStyle = rgb(highlightColor, 0.3);
        ctx.beginPath();
        ctx.moveTo(layerCenterX, layerCenterY - layerHeight);
        ctx.lineTo(layerCenterX + layerWidth / 2, layerCenterY);
        ctx.lineTo(layerCenterX + layerWidth / 4, layerCenterY);
        ctx.lineTo(layerCenterX, layerCenterY - layerHeight / 2);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  ctx.restore();
}

// ============================================================================
// ENHANCED MOUNTAIN RENDERING
// ============================================================================

/**
 * Draw realistic mountain/metal deposit with detailed shading
 */
export function drawEnhancedMountain(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  hasOre: boolean,
  animTime: number,
  zoom: number,
  options: {
    ambient?: number;
    height?: number; // 0.5-1.5 range for varied peak heights
  } = {}
): void {
  const { ambient = 1.0, height = 1.0 } = options;
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = screenX + w / 2;
  const cy = screenY + h / 2;

  // Mountain base hash for consistent randomness
  const baseHash = tileHash(gridX, gridY);
  const peakOffset = (baseHash - 0.5) * w * 0.15;

  // Rock base (bottom portion)
  const baseColor = {
    r: Math.round(MOUNTAIN_COLORS.baseDark.r * ambient),
    g: Math.round(MOUNTAIN_COLORS.baseDark.g * ambient),
    b: Math.round(MOUNTAIN_COLORS.baseDark.b * ambient),
  };
  
  ctx.fillStyle = rgb(baseColor);
  ctx.beginPath();
  ctx.moveTo(cx, screenY + h * 0.2);
  ctx.lineTo(screenX + w, cy);
  ctx.lineTo(cx, screenY + h);
  ctx.lineTo(screenX, cy);
  ctx.closePath();
  ctx.fill();

  // Main peak
  const peakHeight = 22 * height;
  const peakX = cx + peakOffset;
  const peakY = screenY + h * 0.2 - peakHeight;

  // Shadow side (left)
  const shadowColor = {
    r: Math.round(MOUNTAIN_COLORS.shadow.r * ambient),
    g: Math.round(MOUNTAIN_COLORS.shadow.g * ambient),
    b: Math.round(MOUNTAIN_COLORS.shadow.b * ambient),
  };
  
  ctx.fillStyle = rgb(shadowColor);
  ctx.beginPath();
  ctx.moveTo(peakX, peakY);
  ctx.lineTo(screenX + w * 0.15, cy - h * 0.1);
  ctx.lineTo(cx, screenY + h * 0.2);
  ctx.lineTo(peakX, peakY);
  ctx.closePath();
  ctx.fill();

  // Lit side (right)
  const litColor = {
    r: Math.round(MOUNTAIN_COLORS.baseMid.r * ambient * 1.1),
    g: Math.round(MOUNTAIN_COLORS.baseMid.g * ambient * 1.1),
    b: Math.round(MOUNTAIN_COLORS.baseMid.b * ambient * 1.1),
  };
  
  ctx.fillStyle = rgb(litColor);
  ctx.beginPath();
  ctx.moveTo(peakX, peakY);
  ctx.lineTo(screenX + w * 0.85, cy - h * 0.1);
  ctx.lineTo(cx, screenY + h * 0.2);
  ctx.lineTo(peakX, peakY);
  ctx.closePath();
  ctx.fill();

  // Snow cap on tall peaks
  if (height > 0.8 && zoom >= 0.5) {
    const snowLineY = peakY + peakHeight * 0.35;
    const snowColor = {
      r: Math.round(MOUNTAIN_COLORS.snow.r * ambient),
      g: Math.round(MOUNTAIN_COLORS.snow.g * ambient),
      b: Math.round(MOUNTAIN_COLORS.snow.b * ambient),
    };
    
    ctx.fillStyle = rgb(snowColor);
    ctx.beginPath();
    ctx.moveTo(peakX, peakY);
    ctx.lineTo(peakX - 6 * height, snowLineY);
    ctx.lineTo(peakX + 6 * height, snowLineY);
    ctx.closePath();
    ctx.fill();
    
    // Snow shadow
    const snowShadow = {
      r: Math.round(MOUNTAIN_COLORS.snowShadow.r * ambient),
      g: Math.round(MOUNTAIN_COLORS.snowShadow.g * ambient),
      b: Math.round(MOUNTAIN_COLORS.snowShadow.b * ambient),
    };
    
    ctx.fillStyle = rgb(snowShadow, 0.4);
    ctx.beginPath();
    ctx.moveTo(peakX, peakY + 3);
    ctx.lineTo(peakX - 4 * height, snowLineY);
    ctx.lineTo(peakX, snowLineY);
    ctx.closePath();
    ctx.fill();
  }

  // Ore deposits with glint
  if (hasOre && zoom >= 0.4) {
    const numOreSpots = 3 + Math.floor(baseHash * 3);
    const glintPhase = animTime * 1.5;
    
    for (let i = 0; i < numOreSpots; i++) {
      const oreHash = tileHash(gridX, gridY, i * 23);
      const oreHash2 = tileHash(gridX + 1, gridY, i * 29);
      
      const oreX = cx + (oreHash - 0.5) * w * 0.5;
      const oreY = cy + (oreHash2 - 0.5) * h * 0.4 - 5;
      const oreSize = 2 + oreHash * 2;
      
      // Base ore color
      const oreColor = {
        r: Math.round(MOUNTAIN_COLORS.ore.r * ambient),
        g: Math.round(MOUNTAIN_COLORS.ore.g * ambient),
        b: Math.round(MOUNTAIN_COLORS.ore.b * ambient),
      };
      
      ctx.fillStyle = rgb(oreColor);
      ctx.beginPath();
      ctx.arc(oreX, oreY, oreSize, 0, Math.PI * 2);
      ctx.fill();
      
      // Glint animation
      const glintActive = Math.sin(glintPhase + oreHash * Math.PI * 4) > 0.6;
      if (glintActive) {
        const glintColor = {
          r: Math.round(MOUNTAIN_COLORS.oreGlint.r * ambient),
          g: Math.round(MOUNTAIN_COLORS.oreGlint.g * ambient),
          b: Math.round(MOUNTAIN_COLORS.oreGlint.b * ambient),
        };
        
        const glintAlpha = 0.5 + Math.sin(glintPhase * 3 + oreHash * 10) * 0.3;
        ctx.fillStyle = rgb(glintColor, glintAlpha);
        ctx.beginPath();
        ctx.arc(oreX + 1, oreY - 1, oreSize * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

// ============================================================================
// ENHANCED OIL DEPOSIT RENDERING
// ============================================================================

/**
 * Draw oil deposit with dark, iridescent surface
 */
export function drawEnhancedOilDeposit(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  animTime: number,
  zoom: number,
  options: {
    ambient?: number;
  } = {}
): void {
  const { ambient = 1.0 } = options;
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = screenX + w / 2;
  const cy = screenY + h / 2;

  // Dark oil base
  const oilBaseColor = {
    r: Math.round(OIL_COLORS.slick.r * ambient),
    g: Math.round(OIL_COLORS.slick.g * ambient),
    b: Math.round(OIL_COLORS.slick.b * ambient),
  };

  ctx.fillStyle = rgb(oilBaseColor);
  ctx.beginPath();
  ctx.moveTo(cx, screenY);
  ctx.lineTo(screenX + w, cy);
  ctx.lineTo(cx, screenY + h);
  ctx.lineTo(screenX, cy);
  ctx.closePath();
  ctx.fill();

  // Iridescent oil sheen animation
  if (zoom >= 0.4) {
    const sheenPhase = animTime * 0.3;
    
    // Create shifting rainbow sheen
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, screenY);
    ctx.lineTo(screenX + w, cy);
    ctx.lineTo(cx, screenY + h);
    ctx.lineTo(screenX, cy);
    ctx.closePath();
    ctx.clip();
    
    // Multiple sheen layers
    for (let i = 0; i < 3; i++) {
      const hash = tileHash(gridX, gridY, i * 7);
      const sheenOffset = (sheenPhase + hash * Math.PI * 2) % (Math.PI * 2);
      const sheenX = cx + Math.cos(sheenOffset) * w * 0.3;
      const sheenY = cy + Math.sin(sheenOffset * 0.5) * h * 0.3;
      
      // Rainbow colors cycling
      const hue = (sheenPhase * 50 + i * 120) % 360;
      ctx.fillStyle = `hsla(${hue}, 40%, 50%, 0.15)`;
      ctx.beginPath();
      ctx.ellipse(sheenX, sheenY, w * 0.2, h * 0.15, sheenOffset, 0, Math.PI * 2);
      ctx.fill();
    }
    
    ctx.restore();
  }

  // Bubbles rising animation
  if (zoom >= 0.5) {
    const bubblePhase = animTime * 0.5;
    const numBubbles = 3;
    
    for (let i = 0; i < numBubbles; i++) {
      const hash = tileHash(gridX, gridY, i * 13);
      const bubbleY = cy + (((bubblePhase * 0.5 + hash) % 1) - 0.5) * h * 0.6;
      const bubbleX = cx + (hash - 0.5) * w * 0.4;
      const bubbleSize = 1 + hash * 1.5;
      
      ctx.fillStyle = rgb(OIL_COLORS.sheen, 0.4);
      ctx.beginPath();
      ctx.arc(bubbleX, bubbleY, bubbleSize, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ============================================================================
// ENHANCED SKY BACKGROUND
// ============================================================================

/**
 * Draw atmospheric sky with optional clouds
 */
export function drawEnhancedSky(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  animTime: number,
  options: {
    timeOfDay?: 'dawn' | 'day' | 'dusk' | 'night';
    clouds?: boolean;
  } = {}
): void {
  const { timeOfDay = 'day', clouds = true } = options;
  const cloudNoiseFn = getCloudNoise();
  
  const width = canvas.width;
  const height = canvas.height;

  // Sky gradient based on time of day
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  
  switch (timeOfDay) {
    case 'dawn':
      gradient.addColorStop(0, '#1a3a5f');
      gradient.addColorStop(0.3, '#4a5a7a');
      gradient.addColorStop(0.6, '#8a6a5a');
      gradient.addColorStop(0.8, '#d4906a');
      gradient.addColorStop(1, '#2a4a3a');
      break;
    case 'dusk':
      gradient.addColorStop(0, '#2a2a4a');
      gradient.addColorStop(0.3, '#5a3a5a');
      gradient.addColorStop(0.6, '#8a4a4a');
      gradient.addColorStop(0.8, '#6a3a3a');
      gradient.addColorStop(1, '#1a2a2a');
      break;
    case 'night':
      gradient.addColorStop(0, '#0a0a1a');
      gradient.addColorStop(0.5, '#0a1020');
      gradient.addColorStop(1, '#0a1a15');
      break;
    default: // day
      gradient.addColorStop(0, '#1a3a5f');
      gradient.addColorStop(0.4, '#2a4a6a');
      gradient.addColorStop(0.7, '#3a5a7a');
      gradient.addColorStop(1, '#1a4a2e');
  }

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Clouds for day/dawn/dusk
  if (clouds && timeOfDay !== 'night') {
    const cloudPhase = animTime * 0.02;
    
    ctx.save();
    ctx.globalAlpha = timeOfDay === 'dusk' ? 0.2 : 0.15;
    
    // Draw several cloud layers
    for (let layer = 0; layer < 2; layer++) {
      const layerSpeed = 0.5 + layer * 0.3;
      const layerScale = 100 + layer * 50;
      
      for (let x = -layerScale; x < width + layerScale; x += layerScale) {
        for (let y = 0; y < height * 0.5; y += layerScale * 0.7) {
          const cloudVal = cloudNoiseFn(
            (x + cloudPhase * width * layerSpeed) / (layerScale * 2),
            y / (layerScale * 2)
          );
          
          if (cloudVal > 0.1) {
            const cloudSize = (cloudVal + 0.5) * layerScale * 0.8;
            const cloudAlpha = Math.min(0.4, cloudVal * 0.5);
            
            ctx.fillStyle = `rgba(255, 255, 255, ${cloudAlpha})`;
            ctx.beginPath();
            ctx.ellipse(x, y, cloudSize, cloudSize * 0.4, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }
    
    ctx.restore();
  }

  // Stars for night
  if (timeOfDay === 'night') {
    const starPhase = animTime * 0.1;
    
    for (let i = 0; i < 50; i++) {
      const hash = tileHash(i, i * 7);
      const hash2 = tileHash(i * 3, i * 11);
      
      const starX = hash * width;
      const starY = hash2 * height * 0.6;
      const twinkle = Math.sin(starPhase + hash * Math.PI * 10) * 0.3 + 0.7;
      
      ctx.fillStyle = `rgba(255, 255, 255, ${twinkle * 0.6})`;
      ctx.beginPath();
      ctx.arc(starX, starY, 0.5 + hash * 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ============================================================================
// UNIT SHADOWS
// ============================================================================

/**
 * Draw a soft shadow under a unit
 */
export function drawUnitShadow(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  size: number,
  options: {
    offsetX?: number;
    offsetY?: number;
    blur?: number;
  } = {}
): void {
  const { offsetX = 2, offsetY = 3, blur = 0.3 } = options;
  
  const shadowX = screenX + offsetX;
  const shadowY = screenY + offsetY;
  
  ctx.fillStyle = `rgba(0, 0, 0, ${blur})`;
  ctx.beginPath();
  ctx.ellipse(shadowX, shadowY, size * 0.8, size * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
}

// ============================================================================
// SELECTION GLOW EFFECT
// ============================================================================

/**
 * Draw a pulsing selection glow around a unit or building
 */
export function drawSelectionGlow(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  size: number,
  animTime: number,
  color: string = '#22c55e'
): void {
  const pulsePhase = animTime * 3;
  const pulseScale = 1 + Math.sin(pulsePhase) * 0.15;
  const pulseAlpha = 0.4 + Math.sin(pulsePhase) * 0.2;
  
  // Outer glow
  ctx.strokeStyle = color;
  ctx.globalAlpha = pulseAlpha * 0.5;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(screenX, screenY, size * pulseScale * 1.2, 0, Math.PI * 2);
  ctx.stroke();
  
  // Inner ring
  ctx.globalAlpha = pulseAlpha;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(screenX, screenY, size * pulseScale, 0, Math.PI * 2);
  ctx.stroke();
  
  ctx.globalAlpha = 1;
}

// ============================================================================
// PARTICLE SYSTEM
// ============================================================================

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: { r: number; g: number; b: number };
  type: 'smoke' | 'dust' | 'spark' | 'splash';
}

const particlePools: Map<string, Particle[]> = new Map();

/**
 * Get or create a particle pool for a specific location
 */
function getParticlePool(key: string): Particle[] {
  if (!particlePools.has(key)) {
    particlePools.set(key, []);
  }
  return particlePools.get(key)!;
}

/**
 * Spawn particles at a location
 */
export function spawnParticles(
  key: string,
  x: number,
  y: number,
  type: Particle['type'],
  count: number
): void {
  const pool = getParticlePool(key);
  
  for (let i = 0; i < count; i++) {
    const particle: Particle = {
      x,
      y,
      vx: (Math.random() - 0.5) * 2,
      vy: type === 'smoke' ? -Math.random() * 2 - 1 : (Math.random() - 0.5) * 3,
      life: 1,
      maxLife: 0.5 + Math.random() * 0.5,
      size: type === 'spark' ? 1 + Math.random() : 2 + Math.random() * 3,
      color: type === 'smoke' ? { r: 80, g: 80, b: 80 } :
             type === 'spark' ? { r: 255, g: 200, b: 100 } :
             type === 'splash' ? { r: 150, g: 180, b: 210 } :
             { r: 140, g: 120, b: 90 },
      type,
    };
    pool.push(particle);
  }
}

/**
 * Update and draw particles
 */
export function updateAndDrawParticles(
  ctx: CanvasRenderingContext2D,
  key: string,
  deltaTime: number
): void {
  const pool = getParticlePool(key);
  
  for (let i = pool.length - 1; i >= 0; i--) {
    const p = pool[i];
    
    // Update
    p.x += p.vx * deltaTime * 60;
    p.y += p.vy * deltaTime * 60;
    p.life -= deltaTime / p.maxLife;
    
    // Gravity for non-smoke particles
    if (p.type !== 'smoke') {
      p.vy += 0.1 * deltaTime * 60;
    }
    
    // Remove dead particles
    if (p.life <= 0) {
      pool.splice(i, 1);
      continue;
    }
    
    // Draw
    const alpha = p.life * 0.6;
    ctx.fillStyle = rgb(p.color, alpha);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Clear all particles for a key
 */
export function clearParticles(key: string): void {
  particlePools.delete(key);
}

// ============================================================================
// FISHING SPOT RENDERING
// ============================================================================

/**
 * Draw fishing spot indicator on water
 */
export function drawFishingSpot(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  animTime: number,
  zoom: number
): void {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = screenX + w / 2;
  const cy = screenY + h / 2;

  // Fish swimming animation
  const fishPhase = animTime * 2;
  
  ctx.save();
  
  // Clip to tile
  ctx.beginPath();
  ctx.moveTo(cx, screenY);
  ctx.lineTo(screenX + w, cy);
  ctx.lineTo(cx, screenY + h);
  ctx.lineTo(screenX, cy);
  ctx.closePath();
  ctx.clip();

  // Draw a few small fish indicators
  const numFish = 3;
  for (let i = 0; i < numFish; i++) {
    const hash = tileHash(Math.floor(screenX), Math.floor(screenY), i * 7);
    const fishX = cx + Math.sin(fishPhase + hash * Math.PI * 2) * w * 0.2;
    const fishY = cy + Math.cos(fishPhase * 0.7 + hash * Math.PI * 3) * h * 0.15;
    const fishSize = 2 + hash * 2;
    const fishDir = Math.sin(fishPhase + hash * 10) > 0 ? 1 : -1;
    
    // Simple fish shape
    ctx.fillStyle = 'rgba(150, 180, 200, 0.4)';
    ctx.beginPath();
    ctx.ellipse(fishX, fishY, fishSize, fishSize * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Tail
    ctx.beginPath();
    ctx.moveTo(fishX - fishSize * fishDir, fishY);
    ctx.lineTo(fishX - fishSize * 1.5 * fishDir, fishY - fishSize * 0.3);
    ctx.lineTo(fishX - fishSize * 1.5 * fishDir, fishY + fishSize * 0.3);
    ctx.closePath();
    ctx.fill();
  }

  // Ripple effect
  const ripplePhase = animTime * 1.5;
  const rippleRadius = 8 + Math.sin(ripplePhase) * 3;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, rippleRadius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}
