/**
 * Rise of Nations - Realistic Graphics (RoN-only)
 *
 * This module provides a higher-fidelity terrain/water/sky renderer for RoN
 * without changing the shared IsoCity renderer.
 *
 * Design goals:
 * - No flat/gradient "green tiles": replace with procedural grass/soil texture.
 * - Animated, depth-inspired water with shoreline foam.
 * - Forest tiles with wind-sway trees + ground shadows.
 * - Cache expensive tile rasterization for performance.
 */
import { createNoise2D } from 'simplex-noise';

import { TILE_HEIGHT, TILE_WIDTH } from '@/components/game/shared';

type Zone = 'none' | 'residential' | 'commercial' | 'industrial';

export type AdjacentCardinals = { north: boolean; east: boolean; south: boolean; west: boolean };

type Vec3 = { r: number; g: number; b: number };

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function mixRgb(a: Vec3, b: Vec3, t: number): Vec3 {
  const tt = clamp01(t);
  return { r: lerp(a.r, b.r, tt), g: lerp(a.g, b.g, tt), b: lerp(a.b, b.b, tt) };
}

function rgbToCss(c: Vec3, a: number = 1): string {
  const rr = Math.round(clamp01(c.r / 255) * 255);
  const gg = Math.round(clamp01(c.g / 255) * 255);
  const bb = Math.round(clamp01(c.b / 255) * 255);
  return `rgba(${rr}, ${gg}, ${bb}, ${clamp01(a)})`;
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2i(x: number, y: number): number {
  // Stable 32-bit-ish hash for grid coords (no Math.random).
  let h = 2166136261;
  h ^= x + 0x9e3779b9 + (h << 6) + (h >>> 2);
  h ^= y + 0x9e3779b9 + (h << 6) + (h >>> 2);
  return h >>> 0;
}

const noise2D = createNoise2D(mulberry32(0xA11CE5ED));

function fbm2(x: number, y: number, octaves: number, lacunarity: number, gain: number): number {
  let amp = 0.5;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise2D(x * freq, y * freq);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return norm > 0 ? sum / norm : 0;
}

function beginDiamondPath(ctx: CanvasRenderingContext2D, screenX: number, screenY: number): void {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  ctx.beginPath();
  ctx.moveTo(screenX + w / 2, screenY);
  ctx.lineTo(screenX + w, screenY + h / 2);
  ctx.lineTo(screenX + w / 2, screenY + h);
  ctx.lineTo(screenX, screenY + h / 2);
  ctx.closePath();
}

type CachedTileKey = string;
type CachedTile = { canvas: HTMLCanvasElement; lastUsedAt: number };

const TILE_CACHE = new Map<CachedTileKey, CachedTile>();
const TILE_CACHE_MAX = 1400;

function pruneTileCache(nowMs: number): void {
  if (TILE_CACHE.size <= TILE_CACHE_MAX) return;
  // Drop least recently used ~10%
  const entries = Array.from(TILE_CACHE.entries());
  entries.sort((a, b) => a[1].lastUsedAt - b[1].lastUsedAt);
  const dropCount = Math.max(50, Math.floor(TILE_CACHE_MAX * 0.1));
  for (let i = 0; i < Math.min(dropCount, entries.length); i++) {
    TILE_CACHE.delete(entries[i]![0]);
  }
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  return c;
}

function zoneTint(zone: Zone): Vec3 {
  // Very subtle tint: keep realism first, readability second.
  switch (zone) {
    case 'residential':
      return { r: 20, g: 50, b: 25 };
    case 'commercial':
      return { r: 60, g: 45, b: 10 };
    case 'industrial':
      return { r: 55, g: 35, b: 25 };
    default:
      return { r: 0, g: 0, b: 0 };
  }
}

function renderRealisticGroundTileToCanvas(
  canvas: HTMLCanvasElement,
  gridX: number,
  gridY: number,
  zone: Zone,
  variant: 'grass' | 'forest_floor' | 'rocky'
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const scale = canvas.width / w;

  // Work in tile-local high-res coordinates.
  ctx.save();
  ctx.scale(scale, scale);
  ctx.translate(-0, -0);

  // Clip to diamond.
  beginDiamondPath(ctx, 0, 0);
  ctx.clip();

  const seed = hash2i(gridX, gridY);
  const rnd = mulberry32(seed);

  const baseGrassDark = { r: 46, g: 70, b: 42 };
  const baseGrassLight = { r: 78, g: 110, b: 60 };
  const baseSoil = { r: 76, g: 60, b: 42 };
  const baseSoilDark = { r: 54, g: 44, b: 32 };

  const baseForestDark = { r: 34, g: 52, b: 34 };
  const baseForestLight = { r: 55, g: 72, b: 45 };
  const leafLitter = { r: 80, g: 64, b: 42 };

  const baseRockA = { r: 92, g: 94, b: 98 };
  const baseRockB = { r: 70, g: 72, b: 78 };

  // Tile-wide lighting: pretend sun from NW (top-left).
  const lightDir = { x: -0.7, y: -0.4 };

  // Base fill with soft 2-stop gradient
  const grad = ctx.createLinearGradient(0, 0, w, h);
  if (variant === 'rocky') {
    grad.addColorStop(0, rgbToCss(baseRockA));
    grad.addColorStop(1, rgbToCss(baseRockB));
  } else if (variant === 'forest_floor') {
    grad.addColorStop(0, rgbToCss(baseForestLight));
    grad.addColorStop(1, rgbToCss(baseForestDark));
  } else {
    grad.addColorStop(0, rgbToCss(baseGrassLight));
    grad.addColorStop(1, rgbToCss(baseGrassDark));
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Micro-variation: blended strokes + speckles (cheap, no per-pixel loop).
  const tint = zoneTint(zone);
  const tintAlpha = zone === 'none' ? 0 : 0.05;

  // Dirt/grass patches
  const patchCount = variant === 'rocky' ? 10 : 16;
  for (let i = 0; i < patchCount; i++) {
    const px = rnd() * w;
    const py = rnd() * h;
    const nx = (gridX + px / w) * 0.18;
    const ny = (gridY + py / h) * 0.18;
    const n = fbm2(nx, ny, 3, 2.0, 0.55);
    const patchSize = (0.06 + rnd() * 0.12) * w;
    const aspect = 0.55 + rnd() * 0.6;
    const ang = (rnd() - 0.5) * 0.9;

    let baseA = baseSoil;
    let baseB = baseGrassLight;
    if (variant === 'forest_floor') {
      baseA = leafLitter;
      baseB = baseForestLight;
    } else if (variant === 'rocky') {
      baseA = baseRockB;
      baseB = baseRockA;
    }

    const patchColor = mixRgb(baseA, baseB, 0.4 + 0.3 * n);
    const withTint = mixRgb(patchColor, tint, tintAlpha);

    ctx.fillStyle = rgbToCss(withTint, 0.20);
    ctx.beginPath();
    ctx.ellipse(px, py, patchSize, patchSize * aspect, ang, 0, Math.PI * 2);
    ctx.fill();
  }

  // Pebbles / micro highlights
  const pebbleCount = variant === 'rocky' ? 22 : variant === 'forest_floor' ? 10 : 14;
  for (let i = 0; i < pebbleCount; i++) {
    const px = rnd() * w;
    const py = rnd() * h;
    const size = 0.7 + rnd() * 1.6;
    const n = fbm2((gridX * 1.3 + px * 0.05) * 0.25, (gridY * 1.1 + py * 0.05) * 0.25, 2, 2.2, 0.55);
    const lit = clamp01(0.55 + 0.45 * n);
    const c0 = variant === 'rocky' ? baseRockA : { r: 170, g: 175, b: 160 };
    const c1 = variant === 'rocky' ? { r: 40, g: 40, b: 45 } : baseSoilDark;
    const c = mixRgb(c1, c0, lit);
    ctx.fillStyle = rgbToCss(c, variant === 'rocky' ? 0.55 : 0.18);
    ctx.beginPath();
    ctx.arc(px, py, size, 0, Math.PI * 2);
    ctx.fill();
  }

  // Subtle AO on lower edges + rim light on upper edges for depth between tiles.
  ctx.globalCompositeOperation = 'multiply';
  const ao = ctx.createLinearGradient(0, 0, 0, h);
  ao.addColorStop(0, 'rgba(0,0,0,0.00)');
  ao.addColorStop(0.65, 'rgba(0,0,0,0.05)');
  ao.addColorStop(1, 'rgba(0,0,0,0.14)');
  ctx.fillStyle = ao;
  ctx.fillRect(0, 0, w, h);

  ctx.globalCompositeOperation = 'screen';
  const rim = ctx.createLinearGradient(0, 0, w, h);
  rim.addColorStop(0, 'rgba(255,255,255,0.10)');
  rim.addColorStop(0.5, 'rgba(255,255,255,0.03)');
  rim.addColorStop(1, 'rgba(255,255,255,0.00)');
  ctx.fillStyle = rim;
  ctx.fillRect(0, 0, w, h);

  ctx.globalCompositeOperation = 'source-over';

  // Optional faint cross-hatching aligned to light direction (reads like grass grain).
  if (variant !== 'rocky') {
    ctx.save();
    ctx.globalAlpha = variant === 'forest_floor' ? 0.06 : 0.05;
    ctx.strokeStyle = 'rgba(20, 30, 20, 1)';
    ctx.lineWidth = 0.6;
    ctx.translate(w / 2, h / 2);
    const angle = Math.atan2(lightDir.y, lightDir.x) + Math.PI / 2;
    ctx.rotate(angle);
    ctx.translate(-w / 2, -h / 2);
    for (let y = -h; y < h * 2; y += 4.2) {
      ctx.beginPath();
      ctx.moveTo(-w, y);
      ctx.lineTo(w * 2, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Restore
  ctx.restore();
}

function getOrCreateCachedGroundTile(
  gridX: number,
  gridY: number,
  zone: Zone,
  variant: 'grass' | 'forest_floor' | 'rocky'
): HTMLCanvasElement {
  const key: CachedTileKey = `g:${variant}:${zone}:${gridX},${gridY}`;
  const now = performance.now();
  const cached = TILE_CACHE.get(key);
  if (cached) {
    cached.lastUsedAt = now;
    return cached.canvas;
  }

  const hiScale = 3; // ~192px wide for a 64px tile
  const canvas = createCanvas(Math.round(TILE_WIDTH * hiScale), Math.round(TILE_HEIGHT * hiScale));
  renderRealisticGroundTileToCanvas(canvas, gridX, gridY, zone, variant);
  TILE_CACHE.set(key, { canvas, lastUsedAt: now });
  pruneTileCache(now);
  return canvas;
}

export function drawRoNRealisticSkyBackground(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  tick: number
): void {
  // A simple day cycle driven by game tick.
  const t = (tick % 4000) / 4000; // 0..1
  const sun = Math.sin(t * Math.PI * 2) * 0.5 + 0.5;

  const topDay = { r: 10, g: 25, b: 44 };
  const midDay = { r: 20, g: 55, b: 80 };
  const botDay = { r: 20, g: 65, b: 45 };

  const topNight = { r: 6, g: 10, b: 20 };
  const midNight = { r: 8, g: 16, b: 28 };
  const botNight = { r: 10, g: 22, b: 18 };

  const dayMix = clamp01(sun * 1.25);
  const top = mixRgb(topNight, topDay, dayMix);
  const mid = mixRgb(midNight, midDay, dayMix);
  const bot = mixRgb(botNight, botDay, dayMix);

  const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
  g.addColorStop(0, rgbToCss(top));
  g.addColorStop(0.55, rgbToCss(mid));
  g.addColorStop(1, rgbToCss(bot));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Soft moving cloud field (very cheap, no per-pixel).
  ctx.save();
  ctx.globalAlpha = 0.10 + 0.08 * dayMix;
  ctx.fillStyle = 'rgba(255,255,255,1)';
  const time = tick * 0.003;
  const cloudBands = 10;
  for (let i = 0; i < cloudBands; i++) {
    const y = (i / (cloudBands - 1)) * canvas.height * 0.55;
    const band = fbm2(i * 0.17, time * 0.08, 3, 2.0, 0.55);
    const x0 = (time * 45 + i * 130) % (canvas.width + 300) - 300;
    const w = 260 + band * 140;
    const h = 40 + band * 28;
    ctx.beginPath();
    ctx.ellipse(x0 + w * 0.5, y + 20, w, h, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Vignette for cinematic depth.
  ctx.save();
  const vignette = ctx.createRadialGradient(
    canvas.width * 0.5,
    canvas.height * 0.45,
    Math.min(canvas.width, canvas.height) * 0.2,
    canvas.width * 0.5,
    canvas.height * 0.5,
    Math.max(canvas.width, canvas.height) * 0.75
  );
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
}

export function drawRoNRealisticGroundTile(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  zone: Zone
): void {
  const tile = getOrCreateCachedGroundTile(gridX, gridY, zone, 'grass');
  // Draw and clip to diamond for clean edges.
  ctx.save();
  beginDiamondPath(ctx, screenX, screenY);
  ctx.clip();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(tile, screenX, screenY, TILE_WIDTH, TILE_HEIGHT);
  ctx.restore();
}

export function drawRoNRealisticRockyGroundTile(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number
): void {
  const tile = getOrCreateCachedGroundTile(gridX, gridY, 'none', 'rocky');
  ctx.save();
  beginDiamondPath(ctx, screenX, screenY);
  ctx.clip();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(tile, screenX, screenY, TILE_WIDTH, TILE_HEIGHT);
  ctx.restore();
}

export function drawRoNRealisticForestTile(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  forestDensity: number,
  tick: number
): void {
  // Ground first
  const ground = getOrCreateCachedGroundTile(gridX, gridY, 'none', 'forest_floor');
  ctx.save();
  beginDiamondPath(ctx, screenX, screenY);
  ctx.clip();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(ground, screenX, screenY, TILE_WIDTH, TILE_HEIGHT);
  ctx.restore();

  // Trees: simple layered canopy with wind sway. Draw in world space.
  const seed = hash2i(gridX, gridY);
  const rnd = mulberry32(seed ^ 0xBADC0DE);
  const time = tick * 0.04;
  const sway = Math.sin(time + (gridX + gridY) * 0.7) * 0.8;

  const density = clamp01(forestDensity / 100);
  const treeCount = Math.round(5 + density * 5); // 5..10

  const canopyDark = { r: 26, g: 52, b: 28 };
  const canopyMid = { r: 38, g: 70, b: 35 };
  const canopyLight = { r: 70, g: 110, b: 58 };
  const trunk = { r: 70, g: 52, b: 34 };

  // Draw "back to front" by y to fake depth.
  const trees: Array<{ x: number; y: number; s: number }> = [];
  for (let i = 0; i < treeCount; i++) {
    // Sample inside diamond-ish region.
    const u = rnd();
    const v = rnd();
    const px = lerp(0.15, 0.85, u);
    const py = lerp(0.28, 0.78, v);
    const s = lerp(0.32, 0.56, rnd()) * (0.85 + density * 0.25);
    trees.push({ x: px, y: py, s });
  }
  trees.sort((a, b) => a.y - b.y);

  for (const t of trees) {
    const cx = screenX + TILE_WIDTH * t.x + sway * (0.2 + t.s);
    const cy = screenY + TILE_HEIGHT * t.y;
    const trunkH = 10 * t.s;
    const canopyR = 10 * t.s;

    // Ground shadow (soft)
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = 'rgba(0,0,0,1)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 6 * t.s, canopyR * 0.9, canopyR * 0.35, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Trunk
    ctx.fillStyle = rgbToCss(trunk, 0.9);
    ctx.beginPath();
    ctx.roundRect(cx - 1.2 * t.s, cy - trunkH * 0.1, 2.4 * t.s, trunkH, 1.2 * t.s);
    ctx.fill();

    // Canopy base
    const cGrad = ctx.createRadialGradient(cx - canopyR * 0.25, cy - trunkH - canopyR * 0.35, canopyR * 0.2, cx, cy - trunkH - canopyR * 0.1, canopyR * 1.2);
    cGrad.addColorStop(0, rgbToCss(canopyLight));
    cGrad.addColorStop(0.55, rgbToCss(canopyMid));
    cGrad.addColorStop(1, rgbToCss(canopyDark));
    ctx.fillStyle = cGrad;
    ctx.beginPath();
    ctx.ellipse(cx, cy - trunkH - canopyR * 0.35, canopyR * 1.05, canopyR * 0.85, 0.1, 0, Math.PI * 2);
    ctx.fill();

    // Canopy clusters
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = rgbToCss(canopyMid);
    const clusterCount = 5;
    for (let k = 0; k < clusterCount; k++) {
      const ang = (k / clusterCount) * Math.PI * 2 + rnd() * 0.4;
      const rr = canopyR * (0.25 + rnd() * 0.25);
      const ox = Math.cos(ang) * canopyR * 0.45;
      const oy = Math.sin(ang) * canopyR * 0.25;
      ctx.beginPath();
      ctx.ellipse(cx + ox, cy - trunkH - canopyR * 0.35 + oy, rr * 1.1, rr * 0.9, ang * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function getOrCreateCachedWaterTileBase(gridX: number, gridY: number): HTMLCanvasElement {
  const key: CachedTileKey = `w:base:${gridX},${gridY}`;
  const now = performance.now();
  const cached = TILE_CACHE.get(key);
  if (cached) {
    cached.lastUsedAt = now;
    return cached.canvas;
  }

  const hiScale = 3;
  const canvas = createCanvas(Math.round(TILE_WIDTH * hiScale), Math.round(TILE_HEIGHT * hiScale));
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const w = TILE_WIDTH;
    const h = TILE_HEIGHT;
    const scale = canvas.width / w;
    ctx.save();
    ctx.scale(scale, scale);
    beginDiamondPath(ctx, 0, 0);
    ctx.clip();

    // Depth-inspired base water gradient (deep center, lighter edges).
    const deep = { r: 10, g: 42, b: 62 };
    const mid = { r: 18, g: 70, b: 92 };
    const shallow = { r: 28, g: 100, b: 112 };

    const g = ctx.createRadialGradient(w * 0.5, h * 0.55, 3, w * 0.5, h * 0.5, w * 0.9);
    g.addColorStop(0, rgbToCss(deep));
    g.addColorStop(0.6, rgbToCss(mid));
    g.addColorStop(1, rgbToCss(shallow));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Subtle texture: short strokes and speckles.
    const seed = hash2i(gridX, gridY) ^ 0x51A7E;
    const rnd = mulberry32(seed);
    ctx.globalAlpha = 0.18;
    for (let i = 0; i < 16; i++) {
      const px = rnd() * w;
      const py = rnd() * h;
      const len = 6 + rnd() * 10;
      const ang = (rnd() - 0.5) * 1.0;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(px - Math.cos(ang) * len * 0.5, py - Math.sin(ang) * len * 0.5);
      ctx.lineTo(px + Math.cos(ang) * len * 0.5, py + Math.sin(ang) * len * 0.5);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.10;
    ctx.fillStyle = 'rgba(255,255,255,1)';
    for (let i = 0; i < 14; i++) {
      ctx.beginPath();
      ctx.arc(rnd() * w, rnd() * h, 0.6 + rnd() * 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  TILE_CACHE.set(key, { canvas, lastUsedAt: now });
  pruneTileCache(now);
  return canvas;
}

export function drawRoNRealisticWaterTile(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  adjacentWater: AdjacentCardinals,
  adjacentLand: AdjacentCardinals,
  tick: number
): void {
  const base = getOrCreateCachedWaterTileBase(gridX, gridY);
  ctx.save();
  beginDiamondPath(ctx, screenX, screenY);
  ctx.clip();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(base, screenX, screenY, TILE_WIDTH, TILE_HEIGHT);

  // Animated wave highlights (screen-space cheap).
  const time = tick * 0.045;
  const cx = screenX + TILE_WIDTH / 2;
  const cy = screenY + TILE_HEIGHT / 2;

  // More enclosed water tiles look calmer (subtler highlights).
  const waterNeighbors =
    (adjacentWater.north ? 1 : 0) +
    (adjacentWater.east ? 1 : 0) +
    (adjacentWater.south ? 1 : 0) +
    (adjacentWater.west ? 1 : 0);
  const highlightScale = 0.85 + 0.15 * (waterNeighbors / 4);

  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = 0.18 * highlightScale;
  ctx.strokeStyle = 'rgba(210, 240, 255, 0.9)';
  ctx.lineWidth = 1.0;
  for (let i = 0; i < 3; i++) {
    const phase = time + (gridX + gridY) * 0.2 + i * 1.7;
    const y = cy + (i - 1) * 6 + Math.sin(phase) * 2;
    ctx.beginPath();
    ctx.moveTo(screenX - 6, y);
    ctx.quadraticCurveTo(cx, y - 3, screenX + TILE_WIDTH + 6, y);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';

  // Shoreline foam along edges facing land.
  const foamAlpha = 0.40;
  const foam = (edge: 'north' | 'east' | 'south' | 'west') => {
    ctx.save();
    ctx.globalAlpha = foamAlpha;
    ctx.fillStyle = 'rgba(245, 250, 255, 1)';
    ctx.strokeStyle = 'rgba(245, 250, 255, 1)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    switch (edge) {
      case 'north':
        ctx.moveTo(screenX, screenY + TILE_HEIGHT / 2);
        ctx.quadraticCurveTo(cx, screenY + 3 + Math.sin(time + gridX * 0.3) * 1.2, screenX + TILE_WIDTH / 2, screenY);
        ctx.quadraticCurveTo(cx + TILE_WIDTH / 4, screenY + TILE_HEIGHT / 4, screenX + TILE_WIDTH, screenY + TILE_HEIGHT / 2);
        break;
      case 'east':
        ctx.moveTo(screenX + TILE_WIDTH / 2, screenY);
        ctx.quadraticCurveTo(screenX + TILE_WIDTH - 2, cy + Math.sin(time + gridY * 0.3) * 1.2, screenX + TILE_WIDTH / 2, screenY + TILE_HEIGHT);
        break;
      case 'south':
        ctx.moveTo(screenX + TILE_WIDTH, screenY + TILE_HEIGHT / 2);
        ctx.quadraticCurveTo(cx, screenY + TILE_HEIGHT - 3 + Math.sin(time + gridX * 0.25) * 1.1, screenX, screenY + TILE_HEIGHT / 2);
        break;
      case 'west':
        ctx.moveTo(screenX + TILE_WIDTH / 2, screenY + TILE_HEIGHT);
        ctx.quadraticCurveTo(screenX + 2, cy + Math.sin(time + gridY * 0.25) * 1.1, screenX + TILE_WIDTH / 2, screenY);
        break;
    }
    ctx.stroke();
    ctx.restore();
  };

  if (adjacentLand.north) foam('north');
  if (adjacentLand.east) foam('east');
  if (adjacentLand.south) foam('south');
  if (adjacentLand.west) foam('west');

  // Shallow tint where land is adjacent (helps beaches read even before beach pass).
  const shallowTint = 'rgba(60, 180, 170, 0.10)';
  ctx.fillStyle = shallowTint;
  if (adjacentLand.north || adjacentLand.east || adjacentLand.south || adjacentLand.west) {
    ctx.globalAlpha = 1;
    ctx.fillRect(screenX, screenY, TILE_WIDTH, TILE_HEIGHT);
  }

  ctx.restore();
}

export function drawRoNRealisticBeachOnWater(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  adjacentLand: AdjacentCardinals,
  tick: number
): void {
  // Paint sandy shallows on top of water tile in a clipped diamond.
  ctx.save();
  beginDiamondPath(ctx, screenX, screenY);
  ctx.clip();

  const time = tick * 0.04;
  const sandDry = { r: 184, g: 165, b: 118 };
  const sandWet = { r: 132, g: 118, b: 86 };

  const g = ctx.createLinearGradient(screenX, screenY, screenX + TILE_WIDTH, screenY + TILE_HEIGHT);
  g.addColorStop(0, rgbToCss(sandDry, 0.10));
  g.addColorStop(1, rgbToCss(sandWet, 0.16));
  ctx.fillStyle = g;
  ctx.fillRect(screenX, screenY, TILE_WIDTH, TILE_HEIGHT);

  // Wet line near shore (animated)
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1;
  const cx = screenX + TILE_WIDTH / 2;
  const cy = screenY + TILE_HEIGHT / 2;
  const wobble = Math.sin(time + (screenX + screenY) * 0.01) * 1.2;
  ctx.beginPath();
  if (adjacentLand.north) {
    ctx.moveTo(screenX + 6, cy - 10);
    ctx.quadraticCurveTo(cx, screenY + 5 + wobble, screenX + TILE_WIDTH - 6, cy - 10);
  } else if (adjacentLand.south) {
    ctx.moveTo(screenX + 6, cy + 10);
    ctx.quadraticCurveTo(cx, screenY + TILE_HEIGHT - 5 + wobble, screenX + TILE_WIDTH - 6, cy + 10);
  } else if (adjacentLand.east) {
    ctx.moveTo(cx + 12, screenY + 6);
    ctx.quadraticCurveTo(screenX + TILE_WIDTH - 4 + wobble, cy, cx + 12, screenY + TILE_HEIGHT - 6);
  } else if (adjacentLand.west) {
    ctx.moveTo(cx - 12, screenY + 6);
    ctx.quadraticCurveTo(screenX + 4 + wobble, cy, cx - 12, screenY + TILE_HEIGHT - 6);
  }
  ctx.stroke();

  ctx.restore();
}

