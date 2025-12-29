/**
 * Rise of Nations - Enhanced Realistic Graphics System
 * 
 * This module provides high-fidelity, realistic terrain, water, lighting, and effects rendering.
 * Uses procedural noise for natural-looking textures with muted, realistic color palettes
 * inspired by satellite imagery and natural landscapes.
 */

import { createNoise2D, NoiseFunction2D } from 'simplex-noise';
import { TILE_WIDTH, TILE_HEIGHT } from '@/components/game/shared';

// ============================================================================
// NOISE GENERATORS (initialized lazily for performance)
// ============================================================================

let terrainNoise: NoiseFunction2D | null = null;
let grassDetailNoise: NoiseFunction2D | null = null;
let waterNoise: NoiseFunction2D | null = null;
let waveNoise: NoiseFunction2D | null = null;
let rockNoise: NoiseFunction2D | null = null;
let sandNoise: NoiseFunction2D | null = null;

function getTerrainNoise(): NoiseFunction2D {
  if (!terrainNoise) terrainNoise = createNoise2D(() => 0.12345);
  return terrainNoise;
}

function getGrassDetailNoise(): NoiseFunction2D {
  if (!grassDetailNoise) grassDetailNoise = createNoise2D(() => 0.54321);
  return grassDetailNoise;
}

function getWaterNoise(): NoiseFunction2D {
  if (!waterNoise) waterNoise = createNoise2D(() => 0.67890);
  return waterNoise;
}

function getWaveNoise(): NoiseFunction2D {
  if (!waveNoise) waveNoise = createNoise2D(() => 0.98765);
  return waveNoise;
}

function getRockNoise(): NoiseFunction2D {
  if (!rockNoise) rockNoise = createNoise2D(() => 0.11111);
  return rockNoise;
}

function getSandNoise(): NoiseFunction2D {
  if (!sandNoise) sandNoise = createNoise2D(() => 0.22222);
  return sandNoise;
}

// ============================================================================
// REALISTIC COLOR PALETTES - Muted, natural tones
// ============================================================================

/**
 * Realistic grass/terrain colors - muted greens, olive tones, earth colors
 * Based on satellite imagery of temperate grasslands
 */
export const REALISTIC_GRASS_COLORS = {
  // Base olive-green tones (less saturated, more realistic)
  primary: { r: 124, g: 135, b: 92 },    // Olive sage
  secondary: { r: 107, g: 119, b: 78 },  // Darker olive
  light: { r: 142, g: 151, b: 108 },     // Light sage
  dark: { r: 89, g: 98, b: 65 },         // Dark moss
  // Earth accent tones for variety
  earth1: { r: 133, g: 122, b: 94 },     // Tan earth
  earth2: { r: 118, g: 110, b: 86 },     // Brown earth
  // Subtle yellow-green highlights
  highlight: { r: 156, g: 163, b: 118 }, // Pale sage
};

/**
 * Realistic water colors - deep blues, turquoise, with depth variation
 * Based on natural ocean and lake colors
 */
export const REALISTIC_WATER_COLORS = {
  // Deep water (ocean)
  deep: { r: 25, g: 55, b: 85 },         // Navy blue
  deepMid: { r: 35, g: 75, b: 105 },     // Deep blue
  // Mid-depth water
  mid: { r: 55, g: 105, b: 135 },        // Ocean blue
  midLight: { r: 75, g: 125, b: 155 },   // Light ocean
  // Shallow water
  shallow: { r: 95, g: 155, b: 175 },    // Coastal turquoise
  shallowLight: { r: 125, g: 180, b: 195 }, // Light turquoise
  // Surface effects
  reflection: { r: 180, g: 210, b: 225 }, // Sky reflection
  sparkle: { r: 255, g: 255, b: 255 },    // Sun sparkle
  // Caustic light patterns
  caustic: { r: 145, g: 195, b: 215 },    // Light caustic
};

/**
 * Realistic beach/sand colors
 * Based on natural coastal sand
 */
export const REALISTIC_BEACH_COLORS = {
  dry: { r: 215, g: 198, b: 165 },       // Dry sand
  warm: { r: 225, g: 210, b: 175 },      // Warm sand  
  wet: { r: 175, g: 158, b: 125 },       // Wet sand
  dark: { r: 155, g: 138, b: 105 },      // Dark wet sand
  foam: { r: 245, g: 248, b: 250 },      // Wave foam
  foamShadow: { r: 210, g: 220, b: 225 }, // Foam shadow
};

/**
 * Realistic mountain/rock colors
 * Based on natural rock formations
 */
export const REALISTIC_MOUNTAIN_COLORS = {
  // Gray rock tones
  rock1: { r: 115, g: 115, b: 120 },     // Medium gray
  rock2: { r: 95, g: 95, b: 100 },       // Dark gray
  rock3: { r: 135, g: 135, b: 138 },     // Light gray
  // Brown rock variants
  rockBrown: { r: 105, g: 95, b: 85 },   // Brown rock
  rockWarm: { r: 125, g: 110, b: 95 },   // Warm gray
  // Shadows and highlights
  shadow: { r: 65, g: 65, b: 70 },       // Deep shadow
  highlight: { r: 165, g: 165, b: 170 }, // Rock highlight
  // Snow
  snow: { r: 248, g: 250, b: 252 },      // Pure snow
  snowShadow: { r: 210, g: 220, b: 235 }, // Blue-tinted snow shadow
  // Ore deposit
  ore: { r: 45, g: 40, b: 35 },          // Dark ore
  oreGlint: { r: 95, g: 85, b: 75 },     // Ore metallic glint
};

/**
 * Realistic forest/tree colors
 */
export const REALISTIC_FOREST_COLORS = {
  // Canopy colors (various greens)
  canopy1: { r: 55, g: 85, b: 50 },      // Dark forest green
  canopy2: { r: 70, g: 100, b: 60 },     // Forest green
  canopy3: { r: 85, g: 115, b: 70 },     // Medium green
  highlight: { r: 105, g: 135, b: 85 },  // Canopy highlight
  // Shadow
  shadow: { r: 35, g: 55, b: 35 },       // Deep forest shadow
  // Trunk colors
  trunk: { r: 75, g: 55, b: 40 },        // Tree bark
  trunkLight: { r: 95, g: 75, b: 55 },   // Light bark
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/** Convert RGB to CSS color string */
function rgb(r: number, g: number, b: number, a = 1): string {
  if (a === 1) {
    return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
  }
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a})`;
}

/** Lerp between two values */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

/** Lerp between two RGB colors */
function lerpColor(
  c1: { r: number; g: number; b: number },
  c2: { r: number; g: number; b: number },
  t: number
): { r: number; g: number; b: number } {
  return {
    r: lerp(c1.r, c2.r, t),
    g: lerp(c1.g, c2.g, t),
    b: lerp(c1.b, c2.b, t),
  };
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

/** Smooth step function for natural transitions */
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// ============================================================================
// REALISTIC TERRAIN RENDERING
// ============================================================================

/**
 * Draw a realistic grass/ground tile with natural color variation
 * Uses muted olive and earth tones instead of cartoon-y bright greens
 */
export function drawRealisticGrassTile(
  ctx: CanvasRenderingContext2D,
  options: {
    screenX: number;
    screenY: number;
    gridX: number;
    gridY: number;
    zoom: number;
    ambient?: number;
    highlight?: boolean;
    selected?: boolean;
  }
): void {
  const { screenX, screenY, gridX, gridY, zoom, ambient = 1.0, highlight = false, selected = false } = options;
  const noise = getTerrainNoise();
  const detailNoise = getGrassDetailNoise();

  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = screenX + w / 2;
  const cy = screenY + h / 2;

  // Multi-scale noise for natural variation
  const largeScale = octaveNoise(noise, gridX * 0.15, gridY * 0.15, 3, 0.5, 0.08);
  const mediumScale = octaveNoise(noise, gridX * 0.4, gridY * 0.4, 2, 0.6, 0.15);
  const smallScale = octaveNoise(detailNoise, gridX * 1.2, gridY * 1.2, 2, 0.5, 0.25);

  // Blend between grass colors based on noise
  // This creates natural-looking patches of different grass types
  const grassT = (largeScale + 1) / 2;
  const earthT = smoothstep(0.4, 0.7, (mediumScale + 1) / 2);
  
  // Select base color - blend between primary grass and earth tones
  let baseColor: { r: number; g: number; b: number };
  if (earthT > 0.5) {
    // More earth tone in this area
    baseColor = lerpColor(
      REALISTIC_GRASS_COLORS.primary,
      lerpColor(REALISTIC_GRASS_COLORS.earth1, REALISTIC_GRASS_COLORS.earth2, grassT),
      (earthT - 0.5) * 0.4
    );
  } else {
    // More grass tone
    baseColor = lerpColor(
      lerpColor(REALISTIC_GRASS_COLORS.primary, REALISTIC_GRASS_COLORS.secondary, grassT),
      lerpColor(REALISTIC_GRASS_COLORS.light, REALISTIC_GRASS_COLORS.dark, 1 - grassT),
      mediumScale * 0.3 + 0.5
    );
  }

  // Apply small-scale variation for micro-texture
  const microVar = smallScale * 12;
  baseColor = {
    r: Math.max(0, Math.min(255, baseColor.r + microVar)),
    g: Math.max(0, Math.min(255, baseColor.g + microVar)),
    b: Math.max(0, Math.min(255, baseColor.b + microVar * 0.5)),
  };

  // Apply ambient lighting
  baseColor = {
    r: baseColor.r * ambient,
    g: baseColor.g * ambient,
    b: baseColor.b * ambient,
  };

  // Create subtle gradient across tile for dimensionality
  const gradient = ctx.createLinearGradient(
    screenX, screenY + h * 0.3,
    screenX + w, screenY + h * 0.7
  );
  
  // Northwest is slightly lighter (sun direction)
  gradient.addColorStop(0, rgb(
    Math.min(255, baseColor.r + 8),
    Math.min(255, baseColor.g + 6),
    Math.min(255, baseColor.b + 4)
  ));
  gradient.addColorStop(0.5, rgb(baseColor.r, baseColor.g, baseColor.b));
  // Southeast is slightly darker
  gradient.addColorStop(1, rgb(
    baseColor.r - 10,
    baseColor.g - 8,
    baseColor.b - 5
  ));

  // Draw base tile
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(cx, screenY);
  ctx.lineTo(screenX + w, cy);
  ctx.lineTo(cx, screenY + h);
  ctx.lineTo(screenX, cy);
  ctx.closePath();
  ctx.fill();

  // Add subtle texture when zoomed in
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

    // Draw subtle grass blade hints
    const numDetails = Math.floor(6 + (zoom - 0.5) * 8);
    for (let i = 0; i < numDetails; i++) {
      const seed = (gridX * 17 + gridY * 31 + i * 7) % 100;
      const dx = (seed % 80 - 40) / 100 * w;
      const dy = ((seed * 3) % 80 - 40) / 100 * h;
      const px = cx + dx;
      const py = cy + dy;
      
      const detailNoiseSample = detailNoise(px * 0.1 + gridX, py * 0.1 + gridY);
      const detailBrightness = detailNoiseSample * 15;
      
      ctx.fillStyle = rgb(
        baseColor.r + detailBrightness,
        baseColor.g + detailBrightness,
        baseColor.b + detailBrightness * 0.5,
        0.3
      );
      
      // Small grass tuft
      ctx.beginPath();
      ctx.ellipse(px, py, 1.5, 0.8, (seed % 180) * Math.PI / 180, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // Very subtle grid line
  if (zoom >= 0.6) {
    ctx.strokeStyle = rgb(baseColor.r - 20, baseColor.g - 20, baseColor.b - 15, 0.15);
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
      ? 'rgba(34, 197, 94, 0.2)' 
      : 'rgba(255, 255, 255, 0.12)';
    ctx.beginPath();
    ctx.moveTo(cx, screenY);
    ctx.lineTo(screenX + w, cy);
    ctx.lineTo(cx, screenY + h);
    ctx.lineTo(screenX, cy);
    ctx.closePath();
    ctx.fill();
    
    ctx.strokeStyle = selected ? '#22c55e' : 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = selected ? 2 : 1.5;
    ctx.stroke();
  }
}

// ============================================================================
// REALISTIC WATER RENDERING
// ============================================================================

/**
 * Draw a realistic water tile with depth variation, subtle waves, and reflections
 */
export function drawRealisticWaterTile(
  ctx: CanvasRenderingContext2D,
  options: {
    screenX: number;
    screenY: number;
    gridX: number;
    gridY: number;
    animTime: number;
    zoom: number;
    adjacentWater: { north: boolean; east: boolean; south: boolean; west: boolean };
  }
): void {
  const { screenX, screenY, gridX, gridY, animTime, zoom, adjacentWater } = options;
  const waterNoiseFn = getWaterNoise();
  const waveNoiseFn = getWaveNoise();

  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = screenX + w / 2;
  const cy = screenY + h / 2;

  // Calculate water depth based on adjacent water (more surrounded = deeper)
  const numAdjacentWater = [adjacentWater.north, adjacentWater.east, adjacentWater.south, adjacentWater.west]
    .filter(Boolean).length;
  const depth = numAdjacentWater / 4;

  // Animated noise for water surface movement
  const waterMovement = octaveNoise(waterNoiseFn, gridX * 0.3 + animTime * 0.15, gridY * 0.3, 2, 0.5, 0.2);
  const surfaceRipple = octaveNoise(waveNoiseFn, gridX * 0.5 + animTime * 0.25, gridY * 0.5 + animTime * 0.1, 2, 0.6, 0.15);

  // Interpolate colors based on depth
  const shallowColor = REALISTIC_WATER_COLORS.shallow;
  const deepColor = REALISTIC_WATER_COLORS.deep;
  const midColor = REALISTIC_WATER_COLORS.mid;
  
  // Base water color varies with depth
  let baseColor: { r: number; g: number; b: number };
  if (depth < 0.5) {
    baseColor = lerpColor(shallowColor, midColor, depth * 2);
  } else {
    baseColor = lerpColor(midColor, deepColor, (depth - 0.5) * 2);
  }

  // Add subtle variation based on position and time
  const colorVar = waterMovement * 8;
  baseColor = {
    r: Math.max(0, Math.min(255, baseColor.r + colorVar)),
    g: Math.max(0, Math.min(255, baseColor.g + colorVar + 3)),
    b: Math.max(0, Math.min(255, baseColor.b + colorVar + 5)),
  };

  // Create gradient for water surface with subtle lighting
  const gradient = ctx.createRadialGradient(
    cx + waterMovement * 4, cy + waterMovement * 2,
    0,
    cx, cy,
    w * 0.65
  );
  
  // Lighter center (sky reflection)
  gradient.addColorStop(0, rgb(
    Math.min(255, baseColor.r + 15),
    Math.min(255, baseColor.g + 12),
    Math.min(255, baseColor.b + 8)
  ));
  gradient.addColorStop(0.4, rgb(baseColor.r, baseColor.g, baseColor.b));
  gradient.addColorStop(1, rgb(
    baseColor.r - 8,
    baseColor.g - 6,
    baseColor.b - 3
  ));

  // Clip to tile and draw
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

  // Draw subtle caustic light patterns (deeper water effect)
  if (depth > 0.3 && zoom >= 0.4) {
    const causticColor = REALISTIC_WATER_COLORS.caustic;
    const numCaustics = Math.floor(2 + depth * 3);
    
    for (let i = 0; i < numCaustics; i++) {
      const seed = (gridX * 13 + gridY * 29 + i * 11);
      const causticPhase = (animTime * 0.8 + seed * 0.1) % (Math.PI * 2);
      const causticIntensity = 0.08 + Math.sin(causticPhase) * 0.04;
      
      const causticX = cx + Math.sin(seed + animTime * 0.5) * w * 0.25;
      const causticY = cy + Math.cos(seed * 1.3 + animTime * 0.3) * h * 0.25;
      
      ctx.fillStyle = rgb(causticColor.r, causticColor.g, causticColor.b, causticIntensity);
      ctx.beginPath();
      // Organic caustic shape
      ctx.moveTo(causticX, causticY - 4);
      ctx.bezierCurveTo(
        causticX + 5, causticY - 2,
        causticX + 4, causticY + 3,
        causticX, causticY + 4
      );
      ctx.bezierCurveTo(
        causticX - 4, causticY + 3,
        causticX - 5, causticY - 2,
        causticX, causticY - 4
      );
      ctx.fill();
    }
  }

  // Draw subtle wave patterns
  if (zoom >= 0.4) {
    const numWaves = 2;
    for (let i = 0; i < numWaves; i++) {
      const wavePhase = (animTime * 0.2 + i * 0.5) % 1;
      const waveY = screenY + h * 0.25 + wavePhase * h * 0.5;
      const waveAmplitude = 1.5 + surfaceRipple * 1.5;
      
      ctx.strokeStyle = rgb(
        REALISTIC_WATER_COLORS.reflection.r,
        REALISTIC_WATER_COLORS.reflection.g,
        REALISTIC_WATER_COLORS.reflection.b,
        0.08 + (1 - wavePhase) * 0.06
      );
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      
      for (let x = screenX; x <= screenX + w; x += 4) {
        const localWave = waveNoiseFn((x + gridX * w) * 0.04 + animTime * 0.3, gridY * 0.2);
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

  // Subtle sun sparkles on shallow water
  if (depth < 0.6 && zoom >= 0.5) {
    const numSparkles = Math.floor(2 + (1 - depth) * 2);
    for (let i = 0; i < numSparkles; i++) {
      const seed = (gridX * 23 + gridY * 37 + i * 17) % 100;
      const sparklePhase = (animTime * 1.5 + seed * 0.15) % 1;
      const sparkleIntensity = Math.pow(Math.max(0, Math.sin(sparklePhase * Math.PI)), 2);
      
      if (sparkleIntensity > 0.3) {
        const sx = cx + (seed % 60 - 30) / 100 * w + waterMovement * 2;
        const sy = cy + ((seed * 3) % 50 - 25) / 100 * h;
        
        ctx.fillStyle = rgb(255, 255, 255, sparkleIntensity * 0.5);
        ctx.beginPath();
        ctx.arc(sx, sy, 0.8 + sparkleIntensity * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  ctx.restore();

  // Subtle tile edge
  if (zoom >= 0.6) {
    ctx.strokeStyle = rgb(30, 60, 90, 0.12);
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
// REALISTIC BEACH RENDERING
// ============================================================================

/**
 * Draw realistic beach/sand transitions on water tiles adjacent to land
 */
export function drawRealisticBeach(
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

  const noise = getSandNoise();
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = screenX + w / 2;
  const cy = screenY + h / 2;

  // Beach width varies naturally
  const beachNoise = octaveNoise(noise, gridX * 0.6, gridY * 0.6, 2, 0.5, 0.25);
  const beachWidth = w * (0.14 + beachNoise * 0.03);

  // Tile corners
  const corners = {
    top: { x: cx, y: screenY },
    right: { x: screenX + w, y: cy },
    bottom: { x: cx, y: screenY + h },
    left: { x: screenX, y: cy },
  };

  // Inward direction vectors (toward center of tile)
  const inwardVectors = {
    north: { dx: 0.707, dy: 0.707 },
    east: { dx: -0.707, dy: 0.707 },
    south: { dx: -0.707, dy: -0.707 },
    west: { dx: 0.707, dy: -0.707 },
  };

  const drawBeachEdge = (
    start: { x: number; y: number },
    end: { x: number; y: number },
    inward: { dx: number; dy: number }
  ) => {
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;
    const innerX = midX + inward.dx * beachWidth;
    const innerY = midY + inward.dy * beachWidth;

    // Sand gradient: wet (near water) to dry (near land)
    const gradient = ctx.createLinearGradient(midX, midY, innerX, innerY);
    const wetSand = REALISTIC_BEACH_COLORS.dark;
    const drySand = REALISTIC_BEACH_COLORS.dry;
    const warmSand = REALISTIC_BEACH_COLORS.warm;
    
    gradient.addColorStop(0, rgb(wetSand.r, wetSand.g, wetSand.b));
    gradient.addColorStop(0.35, rgb(
      lerp(wetSand.r, warmSand.r, 0.6),
      lerp(wetSand.g, warmSand.g, 0.6),
      lerp(wetSand.b, warmSand.b, 0.6)
    ));
    gradient.addColorStop(0.7, rgb(warmSand.r, warmSand.g, warmSand.b));
    gradient.addColorStop(1, rgb(drySand.r, drySand.g, drySand.b));

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.lineTo(end.x + inward.dx * beachWidth, end.y + inward.dy * beachWidth);
    ctx.lineTo(start.x + inward.dx * beachWidth, start.y + inward.dy * beachWidth);
    ctx.closePath();
    ctx.fill();

    // Animated foam line
    const foamPhase = (animTime * 0.4) % 1;
    const foamWidth = beachWidth * (0.15 + Math.sin(foamPhase * Math.PI) * 0.08);
    const foamDist = beachWidth * (0.6 + Math.sin(animTime * 0.8) * 0.15);
    
    const foamColor = REALISTIC_BEACH_COLORS.foam;
    ctx.save();
    ctx.strokeStyle = rgb(foamColor.r, foamColor.g, foamColor.b, 0.35 + Math.sin(animTime * 1.5) * 0.1);
    ctx.lineWidth = foamWidth;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(
      start.x + inward.dx * foamDist,
      start.y + inward.dy * foamDist
    );
    ctx.lineTo(
      end.x + inward.dx * foamDist,
      end.y + inward.dy * foamDist
    );
    ctx.stroke();

    // Secondary foam line (smaller, offset timing)
    const foam2Phase = (animTime * 0.4 + 0.4) % 1;
    const foam2Dist = beachWidth * (0.4 + Math.sin(animTime * 0.6 + 1) * 0.1);
    ctx.strokeStyle = rgb(foamColor.r, foamColor.g, foamColor.b, 0.2 + Math.sin(foam2Phase * Math.PI) * 0.15);
    ctx.lineWidth = foamWidth * 0.6;
    ctx.beginPath();
    ctx.moveTo(
      start.x + inward.dx * foam2Dist,
      start.y + inward.dy * foam2Dist
    );
    ctx.lineTo(
      end.x + inward.dx * foam2Dist,
      end.y + inward.dy * foam2Dist
    );
    ctx.stroke();
    ctx.restore();
  };

  // Draw beach edges
  if (north) drawBeachEdge(corners.left, corners.top, inwardVectors.north);
  if (east) drawBeachEdge(corners.top, corners.right, inwardVectors.east);
  if (south) drawBeachEdge(corners.right, corners.bottom, inwardVectors.south);
  if (west) drawBeachEdge(corners.bottom, corners.left, inwardVectors.west);

  // Sand grain texture when zoomed in
  if (zoom >= 0.65) {
    const edges = [
      { active: north, vec: inwardVectors.north },
      { active: east, vec: inwardVectors.east },
      { active: south, vec: inwardVectors.south },
      { active: west, vec: inwardVectors.west },
    ];
    
    const numGrains = 6;
    for (let i = 0; i < numGrains; i++) {
      const seed = (gridX * 19 + gridY * 41 + i * 13) % 100;
      const edgeIdx = seed % 4;
      const edge = edges[edgeIdx];
      
      if (edge.active) {
        const grainDist = (seed % 70) / 100 * beachWidth;
        const spreadX = (seed % 40 - 20) * 0.4;
        const spreadY = ((seed * 3) % 40 - 20) * 0.4;
        const grainX = cx + edge.vec.dx * grainDist + spreadX;
        const grainY = cy + edge.vec.dy * grainDist + spreadY;
        
        const darkSand = REALISTIC_BEACH_COLORS.dark;
        ctx.fillStyle = rgb(darkSand.r + (seed % 30), darkSand.g + (seed % 25), darkSand.b + (seed % 20), 0.25);
        ctx.beginPath();
        ctx.arc(grainX, grainY, 0.4 + (seed % 3) * 0.1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

// ============================================================================
// REALISTIC MOUNTAIN RENDERING
// ============================================================================

/**
 * Draw realistic mountain/ore deposit with detailed rock textures
 */
export function drawRealisticMountain(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  hasMetalDeposit: boolean,
  zoom: number
): void {
  const noise = getRockNoise();
  const terrainNoiseFn = getTerrainNoise();
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = screenX + w / 2;
  const cy = screenY + h / 2;

  // Draw rocky base terrain
  const baseNoise = octaveNoise(noise, gridX * 0.4, gridY * 0.4, 2, 0.5, 0.2);
  const rock1 = REALISTIC_MOUNTAIN_COLORS.rock1;
  const rock2 = REALISTIC_MOUNTAIN_COLORS.rock2;
  const rockWarm = REALISTIC_MOUNTAIN_COLORS.rockWarm;
  
  // Base color blend
  const baseColor = lerpColor(
    lerpColor(rock1, rock2, (baseNoise + 1) / 2),
    rockWarm,
    0.2
  );

  const baseGradient = ctx.createLinearGradient(screenX, screenY, screenX + w, screenY + h);
  baseGradient.addColorStop(0, rgb(baseColor.r + 10, baseColor.g + 10, baseColor.b + 8));
  baseGradient.addColorStop(0.5, rgb(baseColor.r, baseColor.g, baseColor.b));
  baseGradient.addColorStop(1, rgb(baseColor.r - 15, baseColor.g - 15, baseColor.b - 12));

  ctx.fillStyle = baseGradient;
  ctx.beginPath();
  ctx.moveTo(cx, screenY);
  ctx.lineTo(screenX + w, cy);
  ctx.lineTo(cx, screenY + h);
  ctx.lineTo(screenX, cy);
  ctx.closePath();
  ctx.fill();

  // Draw mountain peaks
  const seed = gridX * 1000 + gridY;
  const numPeaks = 6 + (seed % 3);

  const peakPositions = [
    { dx: 0.5, dy: 0.26, sizeMult: 1.5, heightMult: 1.4 },
    { dx: 0.33, dy: 0.32, sizeMult: 1.2, heightMult: 1.15 },
    { dx: 0.67, dy: 0.34, sizeMult: 1.25, heightMult: 1.2 },
    { dx: 0.42, dy: 0.44, sizeMult: 1.0, heightMult: 0.95 },
    { dx: 0.58, dy: 0.46, sizeMult: 1.05, heightMult: 1.0 },
    { dx: 0.5, dy: 0.54, sizeMult: 0.85, heightMult: 0.8 },
    { dx: 0.28, dy: 0.50, sizeMult: 0.7, heightMult: 0.65 },
    { dx: 0.72, dy: 0.48, sizeMult: 0.75, heightMult: 0.7 },
  ];

  for (let i = 0; i < Math.min(numPeaks, peakPositions.length); i++) {
    const pos = peakPositions[i];
    const peakSeed = seed * 7 + i * 13;
    const peakNoise = terrainNoiseFn((gridX + i) * 0.25, (gridY + i) * 0.25);

    const baseX = screenX + w * pos.dx + ((peakSeed % 6) - 3) * 0.4;
    const baseY = screenY + h * pos.dy + ((peakSeed * 3 % 4) - 2) * 0.25;
    const baseWidth = (13 + (peakSeed % 5)) * pos.sizeMult;
    const peakHeight = (16 + (peakSeed * 2 % 8)) * pos.heightMult;

    const peakX = baseX + ((peakSeed % 3) - 1) * 0.4;
    const peakY = baseY - peakHeight;

    // Left face (shadow)
    const shadowColor = REALISTIC_MOUNTAIN_COLORS.shadow;
    const shadowVar = peakNoise * 8;
    ctx.fillStyle = rgb(shadowColor.r + shadowVar, shadowColor.g + shadowVar, shadowColor.b + shadowVar);
    ctx.beginPath();
    ctx.moveTo(peakX, peakY);
    // Add ridge detail
    const leftRidgeX = baseX - baseWidth * 0.25;
    const leftRidgeY = baseY - peakHeight * 0.35;
    ctx.lineTo(leftRidgeX, leftRidgeY);
    ctx.lineTo(baseX - baseWidth * 0.5, baseY);
    ctx.lineTo(baseX, baseY);
    ctx.closePath();
    ctx.fill();

    // Right face (lit)
    const highlightColor = REALISTIC_MOUNTAIN_COLORS.highlight;
    const rock3 = REALISTIC_MOUNTAIN_COLORS.rock3;
    const litColor = lerpColor(rock3, highlightColor, 0.3);
    ctx.fillStyle = rgb(litColor.r, litColor.g, litColor.b);
    ctx.beginPath();
    ctx.moveTo(peakX, peakY);
    const rightRidgeX = baseX + baseWidth * 0.22;
    const rightRidgeY = baseY - peakHeight * 0.32;
    ctx.lineTo(rightRidgeX, rightRidgeY);
    ctx.lineTo(baseX + baseWidth * 0.5, baseY);
    ctx.lineTo(baseX, baseY);
    ctx.closePath();
    ctx.fill();

    // Central ridge detail
    if (pos.heightMult > 0.8 && zoom >= 0.5) {
      ctx.fillStyle = rgb(shadowColor.r + 15, shadowColor.g + 15, shadowColor.b + 12, 0.6);
      ctx.beginPath();
      ctx.moveTo(peakX, peakY);
      ctx.lineTo(peakX - 1, peakY + peakHeight * 0.45);
      ctx.lineTo(peakX + 1, peakY + peakHeight * 0.45);
      ctx.closePath();
      ctx.fill();
    }

    // Snow cap on taller peaks
    if (pos.heightMult >= 1.0 && zoom >= 0.45) {
      const snowHeight = peakHeight * 0.22;
      const snow = REALISTIC_MOUNTAIN_COLORS.snow;
      const snowShadow = REALISTIC_MOUNTAIN_COLORS.snowShadow;
      
      // Snow shadow side
      ctx.fillStyle = rgb(snowShadow.r, snowShadow.g, snowShadow.b);
      ctx.beginPath();
      ctx.moveTo(peakX, peakY);
      ctx.lineTo(peakX - baseWidth * 0.08, peakY + snowHeight);
      ctx.lineTo(peakX, peakY + snowHeight * 0.8);
      ctx.closePath();
      ctx.fill();
      
      // Snow lit side
      ctx.fillStyle = rgb(snow.r, snow.g, snow.b);
      ctx.beginPath();
      ctx.moveTo(peakX, peakY);
      ctx.lineTo(peakX, peakY + snowHeight * 0.8);
      ctx.lineTo(peakX + baseWidth * 0.08, peakY + snowHeight);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Ore deposits
  if (hasMetalDeposit && zoom >= 0.45) {
    const numOre = 5 + (seed % 3);
    const ore = REALISTIC_MOUNTAIN_COLORS.ore;
    const oreGlint = REALISTIC_MOUNTAIN_COLORS.oreGlint;
    
    for (let i = 0; i < numOre; i++) {
      const oreSeed = seed * 11 + i * 17;
      const oreX = screenX + w * 0.22 + ((oreSeed % 55) / 100) * w * 0.56;
      const oreY = screenY + h * 0.62 + ((oreSeed * 3 % 35) / 100) * h * 0.28;
      const oreSize = 1.8 + (oreSeed % 2) * 0.5;

      // Dark ore
      ctx.fillStyle = rgb(ore.r, ore.g, ore.b);
      ctx.beginPath();
      ctx.moveTo(oreX, oreY - oreSize);
      ctx.lineTo(oreX + oreSize * 0.9, oreY);
      ctx.lineTo(oreX, oreY + oreSize);
      ctx.lineTo(oreX - oreSize * 0.9, oreY);
      ctx.closePath();
      ctx.fill();

      // Metallic glint
      ctx.fillStyle = rgb(oreGlint.r, oreGlint.g, oreGlint.b, 0.6);
      ctx.beginPath();
      ctx.arc(oreX - oreSize * 0.25, oreY - oreSize * 0.25, oreSize * 0.25, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Scattered boulders at base
  const numBoulders = 6 + (seed % 4);
  for (let i = 0; i < numBoulders; i++) {
    const bSeed = seed * 19 + i * 23;
    const bx = screenX + w * 0.18 + ((bSeed % 100) / 100) * w * 0.64;
    const by = screenY + h * 0.58 + ((bSeed * 3 % 40) / 100) * h * 0.35;
    const bSize = 1.8 + (bSeed % 3) * 0.6;

    const rock1Color = REALISTIC_MOUNTAIN_COLORS.rock1;
    ctx.fillStyle = rgb(rock1Color.r - 5, rock1Color.g - 5, rock1Color.b - 3);
    ctx.beginPath();
    ctx.arc(bx, by, bSize, 0, Math.PI * 2);
    ctx.fill();

    // Boulder highlight
    ctx.fillStyle = rgb(rock1Color.r + 25, rock1Color.g + 25, rock1Color.b + 22, 0.5);
    ctx.beginPath();
    ctx.arc(bx - bSize * 0.3, by - bSize * 0.3, bSize * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ============================================================================
// REALISTIC FOREST RENDERING
// ============================================================================

/**
 * Draw realistic procedural forest with detailed trees
 */
export function drawRealisticForest(
  ctx: CanvasRenderingContext2D,
  options: {
    screenX: number;
    screenY: number;
    gridX: number;
    gridY: number;
    forestDensity: number;
    zoom: number;
    animTime: number;
  }
): void {
  const { screenX, screenY, gridX, gridY, forestDensity, zoom, animTime } = options;
  const noise = getTerrainNoise();
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;

  // First draw grass base
  drawRealisticGrassTile(ctx, { screenX, screenY, gridX, gridY, zoom });

  // Number of trees based on density
  const numTrees = Math.floor(5 + (forestDensity / 100) * 5);

  // Tree positions (back to front for proper layering)
  const treePositions = [
    { dx: 0.5, dy: 0.32, scale: 1.1, layer: 0 },
    { dx: 0.28, dy: 0.38, scale: 0.95, layer: 0 },
    { dx: 0.72, dy: 0.40, scale: 1.0, layer: 0 },
    { dx: 0.18, dy: 0.50, scale: 0.75, layer: 1 },
    { dx: 0.5, dy: 0.52, scale: 1.0, layer: 1 },
    { dx: 0.82, dy: 0.52, scale: 0.8, layer: 1 },
    { dx: 0.35, dy: 0.62, scale: 0.7, layer: 2 },
    { dx: 0.65, dy: 0.64, scale: 0.75, layer: 2 },
    { dx: 0.5, dy: 0.72, scale: 0.6, layer: 2 },
    { dx: 0.22, dy: 0.68, scale: 0.55, layer: 2 },
  ];

  for (let i = 0; i < Math.min(numTrees, treePositions.length); i++) {
    const pos = treePositions[i];
    const seed = (gridX * 31 + gridY * 17 + i * 7) % 100;
    const treeNoise = noise((gridX + i) * 0.4, (gridY + i) * 0.4);

    // Tree position with natural variation
    const treeX = screenX + w * pos.dx + (seed % 10 - 5) * 0.02 * w;
    const treeY = screenY + h * pos.dy + ((seed * 3) % 8 - 4) * 0.015 * h;
    const scale = pos.scale * (0.92 + (seed % 16) / 100);

    // Tree dimensions
    const trunkHeight = 5 * scale;
    const trunkWidth = 1.8 * scale;
    const canopyRadius = 5.5 * scale;

    // Subtle wind animation
    const windOffset = Math.sin(animTime * 1.2 + seed * 0.08) * 0.4 * scale;

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
    ctx.beginPath();
    ctx.ellipse(treeX + 2.5, treeY + 1.5, canopyRadius * 0.65, canopyRadius * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();

    // Trunk
    const trunk = REALISTIC_FOREST_COLORS.trunk;
    const trunkLight = REALISTIC_FOREST_COLORS.trunkLight;
    ctx.fillStyle = rgb(
      lerp(trunk.r, trunkLight.r, 0.3),
      lerp(trunk.g, trunkLight.g, 0.3),
      lerp(trunk.b, trunkLight.b, 0.3)
    );
    ctx.fillRect(treeX - trunkWidth / 2, treeY - trunkHeight, trunkWidth, trunkHeight + 1);

    // Canopy layers
    const canopy1 = REALISTIC_FOREST_COLORS.canopy1;
    const canopy2 = REALISTIC_FOREST_COLORS.canopy2;
    const canopy3 = REALISTIC_FOREST_COLORS.canopy3;
    const highlight = REALISTIC_FOREST_COLORS.highlight;
    const shadow = REALISTIC_FOREST_COLORS.shadow;

    // Back canopy layer (darker)
    const backColor = lerpColor(canopy1, shadow, 0.3);
    ctx.fillStyle = rgb(backColor.r + treeNoise * 8, backColor.g + treeNoise * 10, backColor.b + treeNoise * 6);
    ctx.beginPath();
    ctx.arc(treeX + windOffset * 0.4, treeY - trunkHeight - canopyRadius * 0.5, canopyRadius * 0.85, 0, Math.PI * 2);
    ctx.fill();

    // Main canopy
    const mainColor = lerpColor(canopy2, canopy3, (treeNoise + 1) / 2);
    ctx.fillStyle = rgb(mainColor.r, mainColor.g, mainColor.b);
    ctx.beginPath();
    ctx.arc(treeX + windOffset, treeY - trunkHeight - canopyRadius * 0.7, canopyRadius * 0.78, 0, Math.PI * 2);
    ctx.fill();

    // Highlight blob
    const highlightColor = lerpColor(canopy3, highlight, 0.5);
    ctx.fillStyle = rgb(highlightColor.r, highlightColor.g, highlightColor.b, 0.7);
    ctx.beginPath();
    ctx.arc(
      treeX + windOffset * 0.6 - canopyRadius * 0.25,
      treeY - trunkHeight - canopyRadius - canopyRadius * 0.05,
      canopyRadius * 0.4,
      0,
      Math.PI * 2
    );
    ctx.fill();

    // Tiny highlight spot
    ctx.fillStyle = rgb(highlight.r, highlight.g, highlight.b, 0.4);
    ctx.beginPath();
    ctx.arc(
      treeX + windOffset * 0.3 - canopyRadius * 0.15,
      treeY - trunkHeight - canopyRadius - canopyRadius * 0.2,
      canopyRadius * 0.15,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
}

// ============================================================================
// ENHANCED SKY RENDERING
// ============================================================================

/**
 * Draw enhanced sky background with realistic atmospheric gradient
 */
export function drawEnhancedSkyBackground(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  timeOfDay: 'day' | 'dawn' | 'dusk' | 'night' = 'day'
): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);

  switch (timeOfDay) {
    case 'night':
      gradient.addColorStop(0, '#0a0c14');
      gradient.addColorStop(0.25, '#0e1220');
      gradient.addColorStop(0.5, '#121824');
      gradient.addColorStop(0.75, '#0f1418');
      gradient.addColorStop(1, '#0a1210');
      break;
    case 'dawn':
      gradient.addColorStop(0, '#1a2a4a');
      gradient.addColorStop(0.2, '#3a3550');
      gradient.addColorStop(0.4, '#6a4548');
      gradient.addColorStop(0.6, '#a06045');
      gradient.addColorStop(0.8, '#7a5040');
      gradient.addColorStop(1, '#1a2818');
      break;
    case 'dusk':
      gradient.addColorStop(0, '#2a2050');
      gradient.addColorStop(0.2, '#4a2548');
      gradient.addColorStop(0.4, '#7a3545');
      gradient.addColorStop(0.6, '#6a4050');
      gradient.addColorStop(0.8, '#3a3040');
      gradient.addColorStop(1, '#1a2020');
      break;
    default: // day
      gradient.addColorStop(0, '#1e3a5a');
      gradient.addColorStop(0.15, '#254260');
      gradient.addColorStop(0.35, '#2d4a65');
      gradient.addColorStop(0.55, '#2a4858');
      gradient.addColorStop(0.75, '#1e3828');
      gradient.addColorStop(1, '#1a3020');
  }

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}
