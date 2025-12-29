/**
 * Rise of Nations - Enhanced Graphics System (Realistic)
 *
 * Goal: noticeably higher visual fidelity without new art assets.
 * - Physically-inspired lighting (sun direction, subtle AO)
 * - Lower-saturation, more natural terrain albedo variation
 * - Water depth shading + animated micro-waves + shoreline foam
 * - Deterministic procedural noise (seeded)
 *
 * NOTE: Keep this module RoN-scoped to avoid changing IsoCity visuals.
 */
import { createNoise2D, type NoiseFunction2D } from 'simplex-noise';
import { TILE_WIDTH, TILE_HEIGHT } from '@/components/game/shared';

// ============================================================================
// Seeded noise (deterministic across reloads)
// ============================================================================

let _noiseLow: NoiseFunction2D | null = null;
let _noiseMid: NoiseFunction2D | null = null;
let _noiseHi: NoiseFunction2D | null = null;
let _noiseWater: NoiseFunction2D | null = null;

function noise2D(seed: string): NoiseFunction2D {
  // Avoid external RNG deps (and TS module-resolution edge cases).
  // Deterministic PRNG from string seed.
  const rng = mulberry32(hashStringToU32(seed));
  return createNoise2D(rng);
}

function hashStringToU32(input: string): number {
  // FNV-1a 32-bit
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(a: number): () => number {
  return () => {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function getNoiseLow(): NoiseFunction2D {
  if (!_noiseLow) _noiseLow = noise2D('ron:terrain:low');
  return _noiseLow;
}
function getNoiseMid(): NoiseFunction2D {
  if (!_noiseMid) _noiseMid = noise2D('ron:terrain:mid');
  return _noiseMid;
}
function getNoiseHi(): NoiseFunction2D {
  if (!_noiseHi) _noiseHi = noise2D('ron:terrain:hi');
  return _noiseHi;
}
function getNoiseWater(): NoiseFunction2D {
  if (!_noiseWater) _noiseWater = noise2D('ron:water');
  return _noiseWater;
}

// ============================================================================
// Math + color helpers
// ============================================================================

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function fract(x: number): number {
  return x - Math.floor(x);
}

function srgbToLinear(c: number): number {
  // c in [0..1]
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

type RGB = { r: number; g: number; b: number };

function rgb(r: number, g: number, b: number): RGB {
  return { r, g, b };
}

function mixRgb(a: RGB, b: RGB, t: number): RGB {
  // Mix in linear space for less “plastic” gradients.
  const ar = srgbToLinear(a.r / 255);
  const ag = srgbToLinear(a.g / 255);
  const ab = srgbToLinear(a.b / 255);
  const br = srgbToLinear(b.r / 255);
  const bg = srgbToLinear(b.g / 255);
  const bb = srgbToLinear(b.b / 255);
  return {
    r: Math.round(clamp01(linearToSrgb(lerp(ar, br, t))) * 255),
    g: Math.round(clamp01(linearToSrgb(lerp(ag, bg, t))) * 255),
    b: Math.round(clamp01(linearToSrgb(lerp(ab, bb, t))) * 255),
  };
}

function rgbToCss(c: RGB, a = 1): string {
  return a === 1 ? `rgb(${c.r}, ${c.g}, ${c.b})` : `rgba(${c.r}, ${c.g}, ${c.b}, ${a})`;
}

function brighten(c: RGB, amount: number): RGB {
  return {
    r: Math.round(clamp01((c.r / 255) + amount) * 255),
    g: Math.round(clamp01((c.g / 255) + amount) * 255),
    b: Math.round(clamp01((c.b / 255) + amount) * 255),
  };
}

function octaveNoise(
  noise: NoiseFunction2D,
  x: number,
  y: number,
  octaves: number,
  persistence: number,
  baseFrequency: number
): number {
  let total = 0;
  let frequency = baseFrequency;
  let amplitude = 1;
  let maxValue = 0;
  for (let i = 0; i < octaves; i++) {
    total += noise(x * frequency, y * frequency) * amplitude;
    maxValue += amplitude;
    amplitude *= persistence;
    frequency *= 2;
  }
  return total / maxValue; // [-1..1]
}

function clipDiamond(ctx: CanvasRenderingContext2D, screenX: number, screenY: number): void {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  ctx.beginPath();
  ctx.moveTo(screenX + w / 2, screenY);
  ctx.lineTo(screenX + w, screenY + h / 2);
  ctx.lineTo(screenX + w / 2, screenY + h);
  ctx.lineTo(screenX, screenY + h / 2);
  ctx.closePath();
  ctx.clip();
}

// ============================================================================
// Palettes (realistic / lower saturation)
// ============================================================================

const PALETTE = {
  grass: {
    // Muted greens with earth influence (temperate)
    deep: rgb(54, 78, 46),
    mid: rgb(74, 102, 60),
    light: rgb(96, 126, 72),
    dry: rgb(110, 110, 74), // straw/olive
    dirt: rgb(110, 92, 62),
    shadow: rgb(28, 40, 26),
    stroke: 'rgba(18, 28, 16, 0.22)',
  },
  water: {
    deep: rgb(10, 38, 64),
    mid: rgb(18, 66, 96),
    shallow: rgb(44, 118, 136),
    foam: rgb(235, 242, 245),
    sparkle: rgb(255, 255, 255),
  },
  sand: {
    dry: rgb(205, 186, 150),
    wet: rgb(160, 142, 112),
    foam: rgb(242, 242, 238),
    darkLine: 'rgba(70, 60, 45, 0.28)',
  },
} as const;

// ============================================================================
// Terrain
// ============================================================================

export type EnhancedGrassOptions = {
  highlight?: boolean;
  selected?: boolean;
  // 0..1 where 1 = full daylight
  ambient?: number;
  // if true, render a darker/denser “forest floor” version
  forestFloor?: boolean;
};

/**
 * Realistic grass tile: low-saturation albedo, soil variation, sun lighting.
 */
export function drawEnhancedGrassTile(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  zoom: number,
  opts: EnhancedGrassOptions = {}
): void {
  const ambient = opts.ambient ?? 1;
  const nLow = getNoiseLow();
  const nMid = getNoiseMid();
  const nHi = getNoiseHi();

  // World-space coordinates for noise (kept stable)
  const wx = gridX * 0.65;
  const wy = gridY * 0.65;

  // Large-scale biome variation (patchiness)
  const macro = octaveNoise(nLow, wx, wy, 3, 0.55, 0.08); // [-1..1]
  const macro01 = (macro + 1) / 2;

  // Dryness pushes toward olive/dirt in some regions
  const dry = octaveNoise(nMid, wx + 31.7, wy - 12.4, 2, 0.55, 0.16);
  const dry01 = (dry + 1) / 2;

  // Micro variation for detail strokes/speckles
  const micro = octaveNoise(nHi, gridX * 2.1, gridY * 2.1, 2, 0.6, 0.42);
  const micro01 = (micro + 1) / 2;

  // Base albedo mix: deep->mid->light with subtle dry influence
  const baseA = mixRgb(PALETTE.grass.deep, PALETTE.grass.mid, smoothstep(0.15, 0.85, macro01));
  const baseB = mixRgb(PALETTE.grass.mid, PALETTE.grass.light, smoothstep(0.25, 0.9, macro01));
  let base = mixRgb(baseA, baseB, 0.55);
  base = mixRgb(base, PALETTE.grass.dry, smoothstep(0.55, 0.95, dry01) * 0.55);

  if (opts.forestFloor) {
    // Cooler/darker with more shadow to read as dense canopy.
    base = mixRgb(base, PALETTE.grass.shadow, 0.35);
  }

  // Sun lighting (fake directional): light from NW => brighten top-left, darken bottom-right.
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = screenX + w / 2;
  const cy = screenY + h / 2;
  const sunDir = { x: -0.75, y: -0.45 }; // NW-ish
  const grad = ctx.createLinearGradient(
    cx + sunDir.x * w * 0.55,
    cy + sunDir.y * h * 0.75,
    cx - sunDir.x * w * 0.55,
    cy - sunDir.y * h * 0.75
  );

  const lit = brighten(base, 0.06 * ambient);
  const mid = brighten(base, 0.01 * ambient);
  const shd = mixRgb(base, PALETTE.grass.shadow, 0.55);

  grad.addColorStop(0, rgbToCss(lit));
  grad.addColorStop(0.55, rgbToCss(mid));
  grad.addColorStop(1, rgbToCss(shd));

  ctx.save();
  clipDiamond(ctx, screenX, screenY);
  ctx.fillStyle = grad;
  ctx.fillRect(screenX - 2, screenY - 2, w + 4, h + 4);

  // Subtle AO around edges to reduce “flat sticker” look.
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = 0.18;
  const ao = ctx.createRadialGradient(cx, cy + h * 0.15, 2, cx, cy + h * 0.15, w * 0.85);
  ao.addColorStop(0, 'rgba(0,0,0,0)');
  ao.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.fillStyle = ao;
  ctx.fillRect(screenX - 2, screenY - 2, w + 4, h + 4);

  // Soil speckles / low vegetation variance at closer zooms.
  if (zoom >= 0.6) {
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.12 + micro01 * 0.06;

    // Deterministic “random” seed per tile.
    const seed = (gridX * 7919 + gridY * 6271) >>> 0;
    const speckCount = opts.forestFloor ? 8 : 6;
    for (let i = 0; i < speckCount; i++) {
      const u = fract(Math.sin((seed + i * 19) * 12.9898) * 43758.5453);
      const v = fract(Math.sin((seed + i * 29) * 78.233) * 43758.5453);
      const px = screenX + w * (0.2 + u * 0.6);
      const py = screenY + h * (0.2 + v * 0.6);
      const s = 0.6 + fract((seed + i * 7) * 0.123) * 0.9;
      const dirtT = smoothstep(0.62, 0.98, dry01) * (0.6 + micro01 * 0.4);
      const speckColor = mixRgb(PALETTE.grass.mid, PALETTE.grass.dirt, dirtT);
      ctx.fillStyle = rgbToCss(speckColor, 0.85);
      ctx.fillRect(px, py, s, s);
    }

    // Short grass stroke lines for texture (very subtle).
    ctx.globalAlpha = 0.07;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 0.8;
    const strokeCount = opts.forestFloor ? 4 : 5;
    for (let i = 0; i < strokeCount; i++) {
      const u = fract(Math.sin((seed + 100 + i * 11) * 12.9898) * 43758.5453);
      const v = fract(Math.sin((seed + 200 + i * 13) * 78.233) * 43758.5453);
      const px = screenX + w * (0.25 + u * 0.5);
      const py = screenY + h * (0.2 + v * 0.55);
      const len = 2 + u * 4;
      const ang = (-0.9 + v * 1.8) * 0.35;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + Math.cos(ang) * len, py + Math.sin(ang) * len * 0.55);
      ctx.stroke();
    }
  }

  ctx.restore();

  // Edge/grid hint only at higher zoom (keeps far zoom clean/realistic).
  if (zoom >= 0.75) {
    ctx.strokeStyle = PALETTE.grass.stroke;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(screenX + w / 2, screenY);
    ctx.lineTo(screenX + w, screenY + h / 2);
    ctx.lineTo(screenX + w / 2, screenY + h);
    ctx.lineTo(screenX, screenY + h / 2);
    ctx.closePath();
    ctx.stroke();
  }

  // Optional highlight overlay (kept subtle; game already draws hover/selection).
  if (opts.highlight || opts.selected) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = opts.selected ? 0.10 : 0.07;
    ctx.fillStyle = 'rgba(255,255,255,1)';
    ctx.beginPath();
    ctx.moveTo(screenX + w / 2, screenY);
    ctx.lineTo(screenX + w, screenY + h / 2);
    ctx.lineTo(screenX + w / 2, screenY + h);
    ctx.lineTo(screenX, screenY + h / 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

// ============================================================================
// Water + shoreline
// ============================================================================

export function drawEnhancedWaterTile(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  adjacentWater: { north: boolean; east: boolean; south: boolean; west: boolean },
  timeSeconds: number,
  zoom: number
): void {
  const n = getNoiseWater();
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = screenX + w / 2;
  const cy = screenY + h / 2;

  const edgeIsShore =
    !adjacentWater.north || !adjacentWater.east || !adjacentWater.south || !adjacentWater.west;
  const shoreFactor = edgeIsShore ? 1 : 0;

  // Low-frequency depth variation (tile-to-tile)
  const depth = octaveNoise(n, gridX * 0.35, gridY * 0.35, 3, 0.55, 0.12); // [-1..1]
  const depth01 = (depth + 1) / 2;

  // Map to palette: deeper offshore, lighter near shore and in “shallower” noise zones.
  const shallowMix = clamp01(0.35 * shoreFactor + 0.55 * smoothstep(0.4, 0.95, depth01));
  const baseA = mixRgb(PALETTE.water.deep, PALETTE.water.mid, smoothstep(0.05, 0.85, depth01));
  const base = mixRgb(baseA, PALETTE.water.shallow, shallowMix);

  ctx.save();
  clipDiamond(ctx, screenX, screenY);

  // Sun reflection gradient (from NW). This is what sells “water” realism.
  const sunDir = { x: -0.8, y: -0.5 };
  const grad = ctx.createLinearGradient(
    cx + sunDir.x * w * 0.7,
    cy + sunDir.y * h * 0.9,
    cx - sunDir.x * w * 0.7,
    cy - sunDir.y * h * 0.9
  );
  grad.addColorStop(0, rgbToCss(brighten(base, 0.08)));
  grad.addColorStop(0.55, rgbToCss(base));
  grad.addColorStop(1, rgbToCss(mixRgb(base, PALETTE.water.deep, 0.35)));

  ctx.fillStyle = grad;
  ctx.fillRect(screenX - 2, screenY - 2, w + 4, h + 4);

  // Micro-waves: animated highlights, scaled down at far zoom to avoid shimmer.
  const waveStrength = zoom >= 0.55 ? 0.18 : 0.08;
  const t = timeSeconds * 0.55;
  const wave = octaveNoise(n, gridX * 0.9 + t, gridY * 0.9 - t * 0.7, 2, 0.6, 0.35);
  const wave01 = (wave + 1) / 2;
  const sparkle = smoothstep(0.72, 0.98, wave01) * waveStrength;
  if (sparkle > 0.001) {
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = sparkle;
    ctx.fillStyle = rgbToCss(PALETTE.water.sparkle, 1);
    // Diagonal streaks (specular “wind ripples”)
    const streakCount = zoom >= 0.8 ? 3 : 2;
    for (let i = 0; i < streakCount; i++) {
      const s = (i + 1) / (streakCount + 1);
      const x0 = lerp(screenX + w * 0.15, screenX + w * 0.85, s) + (wave01 - 0.5) * 2;
      const y0 = lerp(screenY + h * 0.15, screenY + h * 0.85, 1 - s) + (wave01 - 0.5) * 1.5;
      ctx.fillRect(x0, y0, 6, 1);
    }
  }

  // Gentle darkening at borders to reduce tiling artifacts.
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = 0.10;
  const vign = ctx.createRadialGradient(cx, cy + h * 0.2, w * 0.15, cx, cy + h * 0.2, w * 0.95);
  vign.addColorStop(0, 'rgba(0,0,0,0)');
  vign.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.fillStyle = vign;
  ctx.fillRect(screenX - 2, screenY - 2, w + 4, h + 4);

  ctx.restore();
}

/**
 * Beach + foam strip on water tiles adjacent to land.
 * Drawn after water tiles, before sprites (to match current render passes).
 */
export function drawEnhancedBeachOnWater(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  adjacentLand: { north: boolean; east: boolean; south: boolean; west: boolean },
  timeSeconds: number,
  zoom: number
): void {
  if (!adjacentLand.north && !adjacentLand.east && !adjacentLand.south && !adjacentLand.west) return;

  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const corners = {
    top: { x: screenX + w / 2, y: screenY },
    right: { x: screenX + w, y: screenY + h / 2 },
    bottom: { x: screenX + w / 2, y: screenY + h },
    left: { x: screenX, y: screenY + h / 2 },
  };

  const beachWidth = w * (zoom >= 0.75 ? 0.12 : 0.10);
  const foamWidth = beachWidth * 0.32;

  const inward = {
    north: { dx: 0.707, dy: 0.707 },
    east: { dx: -0.707, dy: 0.707 },
    south: { dx: -0.707, dy: -0.707 },
    west: { dx: 0.707, dy: -0.707 },
  } as const;

  const t = timeSeconds * 0.9;
  const foamNoise = getNoiseWater();
  const wobble = (edgeSeed: number) => (foamNoise(edgeSeed + t, edgeSeed * 0.37 - t * 0.6) + 1) / 2; // [0..1]

  const drawStrip = (
    a: { x: number; y: number },
    b: { x: number; y: number },
    dir: { dx: number; dy: number },
    edgeSeed: number
  ) => {
    // Sand gradient (dry->wet toward water interior)
    const g = ctx.createLinearGradient(
      (a.x + b.x) / 2,
      (a.y + b.y) / 2,
      (a.x + b.x) / 2 + dir.dx * beachWidth,
      (a.y + b.y) / 2 + dir.dy * beachWidth
    );
    g.addColorStop(0, rgbToCss(PALETTE.sand.dry, 0.95));
    g.addColorStop(1, rgbToCss(PALETTE.sand.wet, 0.95));

    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(b.x + dir.dx * beachWidth, b.y + dir.dy * beachWidth);
    ctx.lineTo(a.x + dir.dx * beachWidth, a.y + dir.dy * beachWidth);
    ctx.closePath();
    ctx.fill();

    // Dark wet line at the water edge
    ctx.strokeStyle = PALETTE.sand.darkLine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(a.x + dir.dx * beachWidth, a.y + dir.dy * beachWidth);
    ctx.lineTo(b.x + dir.dx * beachWidth, b.y + dir.dy * beachWidth);
    ctx.stroke();

    // Foam, slightly animated and irregular
    const f = wobble(edgeSeed);
    const foamJ = (f - 0.5) * foamWidth * 0.7;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = zoom >= 0.7 ? 0.55 : 0.35;
    ctx.fillStyle = rgbToCss(PALETTE.sand.foam, 1);
    ctx.beginPath();
    ctx.moveTo(a.x + dir.dx * (beachWidth + foamJ), a.y + dir.dy * (beachWidth + foamJ));
    ctx.lineTo(b.x + dir.dx * (beachWidth + foamJ), b.y + dir.dy * (beachWidth + foamJ));
    ctx.lineTo(b.x + dir.dx * (beachWidth + foamWidth + foamJ), b.y + dir.dy * (beachWidth + foamWidth + foamJ));
    ctx.lineTo(a.x + dir.dx * (beachWidth + foamWidth + foamJ), a.y + dir.dy * (beachWidth + foamWidth + foamJ));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  // Edge mapping: land adjacency indicates which water edges get a beach strip.
  if (adjacentLand.north) drawStrip(corners.left, corners.top, inward.north, screenX * 0.01 + screenY * 0.02 + 11.3);
  if (adjacentLand.east) drawStrip(corners.top, corners.right, inward.east, screenX * 0.01 + screenY * 0.02 + 23.7);
  if (adjacentLand.south) drawStrip(corners.right, corners.bottom, inward.south, screenX * 0.01 + screenY * 0.02 + 37.1);
  if (adjacentLand.west) drawStrip(corners.bottom, corners.left, inward.west, screenX * 0.01 + screenY * 0.02 + 41.9);
}

// ============================================================================
// Sky (subtle, realistic gradient)
// ============================================================================

export function drawEnhancedSky(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  timeSeconds: number
): void {
  // Simple but richer than the shared gradient: adds a slight haze near horizon.
  const h = canvas.height;
  const t = (Math.sin(timeSeconds * 0.03) + 1) / 2; // very slow drift

  const top = mixRgb(rgb(15, 34, 58), rgb(18, 42, 66), t);
  const mid = mixRgb(rgb(35, 72, 102), rgb(30, 64, 92), t);
  const horizon = mixRgb(rgb(90, 110, 120), rgb(80, 100, 112), t);

  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, rgbToCss(top));
  g.addColorStop(0.55, rgbToCss(mid));
  g.addColorStop(1, rgbToCss(horizon));

  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Soft haze band near horizon to improve depth perception.
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = 0.08;
  const haze = ctx.createLinearGradient(0, h * 0.55, 0, h);
  haze.addColorStop(0, 'rgba(255,255,255,0)');
  haze.addColorStop(1, 'rgba(255,255,255,1)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, h * 0.55, canvas.width, h * 0.5);
  ctx.restore();
}

