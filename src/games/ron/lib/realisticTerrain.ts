/**
 * Rise of Nations - Realistic Terrain Renderer (RoN-only)
 *
 * This module avoids changing the shared IsoCity renderer and focuses on
 * higher-fidelity canvas 2D terrain: textured grass/soil, depth-based animated water,
 * shoreline foam, and improved resource tiles (forests/mountains/oil).
 */
/* eslint-disable no-bitwise */

import { createNoise2D } from 'simplex-noise';
import type { RoNTile } from '../types/game';
import { TILE_HEIGHT, TILE_WIDTH } from '@/components/game/shared';

type TimeOfDay = 'day' | 'dusk' | 'night';

export type RoNRealisticTerrainOptions = {
  seed: number;
};

type Adjacent4 = { north: boolean; east: boolean; south: boolean; west: boolean };

type RendererState = {
  seed: number;
  noise2D: ReturnType<typeof createNoise2D>;
  patterns: null | {
    grass: CanvasPattern;
    dirt: CanvasPattern;
    rock: CanvasPattern;
    sand: CanvasPattern;
    wetSand: CanvasPattern;
    waterDetail: CanvasPattern;
  };
  depthCache: {
    key: string;
    depth: Uint8Array;
    size: number;
  } | null;
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

export function hashStringToSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function hsl(h: number, s: number, l: number, a: number = 1): string {
  const hh = ((h % 360) + 360) % 360;
  return `hsla(${hh}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%, ${a})`;
}

function diamondPath(ctx: CanvasRenderingContext2D, screenX: number, screenY: number): void {
  ctx.beginPath();
  ctx.moveTo(screenX + TILE_WIDTH / 2, screenY);
  ctx.lineTo(screenX + TILE_WIDTH, screenY + TILE_HEIGHT / 2);
  ctx.lineTo(screenX + TILE_WIDTH / 2, screenY + TILE_HEIGHT);
  ctx.lineTo(screenX, screenY + TILE_HEIGHT / 2);
  ctx.closePath();
}

function makePattern(
  baseSize: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
): CanvasPattern {
  const c = document.createElement('canvas');
  c.width = baseSize;
  c.height = baseSize;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Failed to create 2d context for pattern');
  draw(ctx, c.width, c.height);
  const pattern = ctx.createPattern(c, 'repeat');
  if (!pattern) throw new Error('Failed to create canvas pattern');
  return pattern;
}

function ensurePatterns(state: RendererState): NonNullable<RendererState['patterns']> {
  if (state.patterns) return state.patterns;

  // Intentionally small and low-frequency: detail comes from blending + lighting.
  const rand = mulberry32(state.seed ^ 0x9e3779b9);
  const n2 = state.noise2D;

  const makeSpeckle = (ctx: CanvasRenderingContext2D, w: number, h: number, count: number, colors: string[]) => {
    for (let i = 0; i < count; i++) {
      const x = rand() * w;
      const y = rand() * h;
      const r = 0.5 + rand() * 1.8;
      ctx.fillStyle = colors[(i + (rand() * 999) | 0) % colors.length]!;
      ctx.globalAlpha = 0.35 + rand() * 0.35;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  const grass = makePattern(128, (ctx, w, h) => {
    // Earthy, less-saturated greens. No flat gradients.
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#2f4f2f');
    g.addColorStop(0.45, '#355a31');
    g.addColorStop(1, '#2b3f2a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // Micro variation from noise
    const img = ctx.getImageData(0, 0, w, h);
    const data = img.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const nn = n2(x * 0.08, y * 0.08) * 0.5 + 0.5;
        const shade = 0.9 + nn * 0.25;
        data[i] = Math.min(255, data[i] * shade);
        data[i + 1] = Math.min(255, data[i + 1] * (0.92 + nn * 0.22));
        data[i + 2] = Math.min(255, data[i + 2] * (0.9 + nn * 0.18));
      }
    }
    ctx.putImageData(img, 0, 0);
    makeSpeckle(ctx, w, h, 520, ['rgba(40, 60, 35, 1)', 'rgba(65, 85, 50, 1)', 'rgba(85, 75, 50, 1)']);
  });

  const dirt = makePattern(128, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#4a3b2a');
    g.addColorStop(1, '#3b2f24');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    makeSpeckle(ctx, w, h, 620, ['rgba(70,55,40,1)', 'rgba(90,75,55,1)', 'rgba(40,30,22,1)']);
  });

  const rock = makePattern(128, (ctx, w, h) => {
    ctx.fillStyle = '#50535a';
    ctx.fillRect(0, 0, w, h);
    makeSpeckle(ctx, w, h, 680, ['rgba(90,95,105,1)', 'rgba(60,65,75,1)', 'rgba(120,120,125,1)']);
    // subtle cracks
    ctx.strokeStyle = 'rgba(30,30,35,0.25)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 18; i++) {
      const x0 = rand() * w;
      const y0 = rand() * h;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(x0 + (rand() - 0.5) * 50, y0 + (rand() - 0.5) * 50, x0 + (rand() - 0.5) * 80, y0 + (rand() - 0.5) * 80);
      ctx.stroke();
    }
  });

  const sand = makePattern(128, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#cbb287');
    g.addColorStop(1, '#b89c72');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    makeSpeckle(ctx, w, h, 700, ['rgba(210,190,140,1)', 'rgba(180,160,110,1)', 'rgba(235,220,170,1)']);
  });

  const wetSand = makePattern(128, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#9b8564');
    g.addColorStop(1, '#7f6a4c');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    makeSpeckle(ctx, w, h, 520, ['rgba(120,100,75,1)', 'rgba(150,130,100,1)']);
    // glossy sheen
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.ellipse(w * 0.35, h * 0.35, w * 0.3, h * 0.18, -0.4, 0, Math.PI * 2);
    ctx.fill();
  });

  const waterDetail = makePattern(128, (ctx, w, h) => {
    ctx.fillStyle = 'rgba(255,255,255,0)';
    ctx.fillRect(0, 0, w, h);
    // fine sparkles/ripples
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 80; i++) {
      const x = rand() * w;
      const y = rand() * h;
      const len = 6 + rand() * 16;
      const a = rand() * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len * 0.35);
      ctx.stroke();
    }
  });

  state.patterns = { grass, dirt, rock, sand, wetSand, waterDetail };
  return state.patterns;
}

function computeDepthKey(grid: RoNTile[][], size: number): string {
  // Lightweight signature: counts + a few sampled positions. Good enough for caching.
  let waterCount = 0;
  let metalCount = 0;
  let forestCount = 0;
  for (let y = 0; y < size; y += 8) {
    for (let x = 0; x < size; x += 8) {
      const t = grid[y]?.[x];
      if (!t) continue;
      if (t.terrain === 'water') waterCount++;
      if (t.hasMetalDeposit) metalCount++;
      if (t.forestDensity > 0) forestCount++;
    }
  }
  return `${size}:${waterCount}:${metalCount}:${forestCount}`;
}

/**
 * Depth = distance from shoreline (0 = next to land, larger = deeper).
 * Computed as multi-source BFS starting from all land tiles.
 */
export function getWaterDepthMap(state: RendererState, grid: RoNTile[][], gridSize: number): Uint8Array {
  const key = computeDepthKey(grid, gridSize);
  if (state.depthCache && state.depthCache.key === key && state.depthCache.size === gridSize) {
    return state.depthCache.depth;
  }

  const depth = new Uint8Array(gridSize * gridSize);
  depth.fill(255);

  const qx = new Int16Array(gridSize * gridSize);
  const qy = new Int16Array(gridSize * gridSize);
  let qh = 0;
  let qt = 0;

  // Initialize from all land tiles (distance 0), then expand into water.
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const t = grid[y]?.[x];
      if (!t) continue;
      if (t.terrain !== 'water') {
        depth[y * gridSize + x] = 0;
        qx[qt] = x;
        qy[qt] = y;
        qt++;
      }
    }
  }

  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const;

  while (qh < qt) {
    const x = qx[qh]!;
    const y = qy[qh]!;
    qh++;
    const base = depth[y * gridSize + x]!;
    const next = base + 1;

    // Only expand into water tiles; land stays 0.
    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= gridSize || ny >= gridSize) continue;
      const idx = ny * gridSize + nx;
      if (depth[idx] <= next) continue;
      const t = grid[ny]?.[nx];
      if (!t) continue;
      if (t.terrain !== 'water') continue;
      depth[idx] = next;
      qx[qt] = nx;
      qy[qt] = ny;
      qt++;
    }
  }

  // Clamp water depth to something visually useful.
  for (let i = 0; i < depth.length; i++) {
    if (depth[i] === 255) depth[i] = 0; // should not happen, but keep safe
    depth[i] = Math.min(depth[i], 18);
  }

  state.depthCache = { key, depth, size: gridSize };
  return depth;
}

function resolveTimeOfDay(timeOfDay: 'day' | 'dusk' | 'night' | 'dynamic', tSeconds: number): TimeOfDay {
  if (timeOfDay !== 'dynamic') return timeOfDay;
  // Slow cycle (roughly ~90s). We keep it subtle to avoid readability issues.
  const phase = (tSeconds / 90) % 1;
  if (phase < 0.62) return 'day';
  if (phase < 0.78) return 'dusk';
  return 'night';
}

function lightingFor(time: TimeOfDay): { ambient: number; sun: number; waterSat: number; waterLight: number } {
  switch (time) {
    case 'night':
      return { ambient: 0.58, sun: 0.42, waterSat: 0.55, waterLight: 0.20 };
    case 'dusk':
      return { ambient: 0.62, sun: 0.55, waterSat: 0.62, waterLight: 0.26 };
    default:
      return { ambient: 0.72, sun: 0.70, waterSat: 0.72, waterLight: 0.30 };
  }
}

export function createRoNRealisticTerrainRenderer(opts: RoNRealisticTerrainOptions) {
  const rand = mulberry32(opts.seed);
  const noise2D = createNoise2D(() => rand());

  const state: RendererState = {
    seed: opts.seed,
    noise2D,
    patterns: null,
    depthCache: null,
  };

  return {
    getWaterDepthMap: (grid: RoNTile[][], gridSize: number): Uint8Array => {
      return getWaterDepthMap(state, grid, gridSize);
    },

    drawSkyTimeOfDay: (setting: 'day' | 'dusk' | 'night' | 'dynamic', nowSeconds: number): TimeOfDay => {
      return resolveTimeOfDay(setting, nowSeconds);
    },

    drawLandTile: (
      ctx: CanvasRenderingContext2D,
      screenX: number,
      screenY: number,
      x: number,
      y: number,
      tile: RoNTile,
      nowSeconds: number,
      timeSetting: 'day' | 'dusk' | 'night' | 'dynamic',
      opts2?: { isRoadUnderlay?: boolean; ownerTint?: string | null; showOil?: boolean }
    ): void => {
      const patterns = ensurePatterns(state);
      const tod = resolveTimeOfDay(timeSetting, nowSeconds);
      const light = lightingFor(tod);

      // Base: grass, with procedural dirt patches to remove the "green tile" look.
      diamondPath(ctx, screenX, screenY);
      ctx.save();
      ctx.clip();

      // Determine local "fertility" for grass-vs-dirt blend.
      const nx = x * 0.06;
      const ny = y * 0.06;
      const fertile = clamp01(noise2D(nx, ny) * 0.5 + 0.55);
      const dirtiness = clamp01(0.55 - fertile + (opts2?.isRoadUnderlay ? 0.15 : 0));

      ctx.fillStyle = patterns.grass;
      ctx.fillRect(screenX - 10, screenY - 10, TILE_WIDTH + 20, TILE_HEIGHT + 20);

      if (dirtiness > 0.06) {
        ctx.globalAlpha = 0.35 + dirtiness * 0.55;
        ctx.fillStyle = patterns.dirt;
        ctx.fillRect(screenX - 10, screenY - 10, TILE_WIDTH + 20, TILE_HEIGHT + 20);
        ctx.globalAlpha = 1;
      }

      // Micro shading to reinforce isometric lighting
      const cx = screenX + TILE_WIDTH / 2;
      const cy = screenY + TILE_HEIGHT / 2;
      const g = ctx.createRadialGradient(cx, cy - TILE_HEIGHT * 0.15, TILE_WIDTH * 0.15, cx, cy, TILE_WIDTH * 0.8);
      g.addColorStop(0, `rgba(255,255,255,${0.10 * light.sun})`);
      g.addColorStop(1, `rgba(0,0,0,${0.18 * (1 - light.ambient)})`);
      ctx.fillStyle = g;
      ctx.fillRect(screenX - 10, screenY - 10, TILE_WIDTH + 20, TILE_HEIGHT + 20);

      // Owner tint: keep it subtle and earthy.
      if (opts2?.ownerTint) {
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = opts2.ownerTint;
        ctx.fillRect(screenX - 10, screenY - 10, TILE_WIDTH + 20, TILE_HEIGHT + 20);
        ctx.globalAlpha = 1;
      }

      ctx.restore();

      // Crisp edge stroke (thin, not cartoony)
      ctx.strokeStyle = 'rgba(10, 15, 12, 0.28)';
      ctx.lineWidth = 0.6;
      diamondPath(ctx, screenX, screenY);
      ctx.stroke();

      // Metal deposit: rocky outcrop + snow hints, no flat gradients.
      if (tile.hasMetalDeposit) {
        diamondPath(ctx, screenX, screenY);
        ctx.save();
        ctx.clip();
        ctx.globalAlpha = 0.95;
        ctx.fillStyle = patterns.rock;
        ctx.fillRect(screenX - 10, screenY - 10, TILE_WIDTH + 20, TILE_HEIGHT + 20);
        ctx.globalAlpha = 1;

        // Ridge shading
        const ridge = ctx.createLinearGradient(screenX, screenY, screenX + TILE_WIDTH, screenY + TILE_HEIGHT);
        ridge.addColorStop(0, 'rgba(255,255,255,0.10)');
        ridge.addColorStop(0.55, 'rgba(0,0,0,0.12)');
        ridge.addColorStop(1, 'rgba(0,0,0,0.20)');
        ctx.fillStyle = ridge;
        ctx.fillRect(screenX - 10, screenY - 10, TILE_WIDTH + 20, TILE_HEIGHT + 20);

        // Peaks (clustered triangles with shading)
        const baseSeed = (x * 73856093) ^ (y * 19349663) ^ (state.seed | 0);
        const prng = mulberry32(baseSeed);
        const peaks = 6 + ((baseSeed >>> 3) % 3);
        for (let i = 0; i < peaks; i++) {
          const px = screenX + TILE_WIDTH * (0.25 + prng() * 0.5);
          const py = screenY + TILE_HEIGHT * (0.25 + prng() * 0.45);
          const h = 10 + prng() * 20;
          const w = 10 + prng() * 12;
          // Shadow face
          ctx.fillStyle = 'rgba(35, 39, 46, 0.85)';
          ctx.beginPath();
          ctx.moveTo(px, py - h);
          ctx.lineTo(px - w * 0.55, py - h * 0.3);
          ctx.lineTo(px - w, py);
          ctx.lineTo(px, py);
          ctx.closePath();
          ctx.fill();
          // Lit face
          ctx.fillStyle = 'rgba(175, 185, 195, 0.85)';
          ctx.beginPath();
          ctx.moveTo(px, py - h);
          ctx.lineTo(px + w * 0.45, py - h * 0.35);
          ctx.lineTo(px + w, py);
          ctx.lineTo(px, py);
          ctx.closePath();
          ctx.fill();
          // Snow cap on taller peaks
          if (h > 22) {
            ctx.fillStyle = 'rgba(245, 245, 245, 0.9)';
            ctx.beginPath();
            ctx.moveTo(px, py - h);
            ctx.lineTo(px - w * 0.15, py - h * 0.78);
            ctx.lineTo(px + w * 0.12, py - h * 0.78);
            ctx.closePath();
            ctx.fill();
          }
        }

        // Ore glints
        for (let i = 0; i < 6; i++) {
          const ox = screenX + TILE_WIDTH * (0.25 + prng() * 0.5);
          const oy = screenY + TILE_HEIGHT * (0.58 + prng() * 0.22);
          ctx.fillStyle = 'rgba(15, 17, 20, 0.85)';
          ctx.beginPath();
          ctx.moveTo(ox, oy - 2);
          ctx.lineTo(ox + 2, oy);
          ctx.lineTo(ox, oy + 2);
          ctx.lineTo(ox - 2, oy);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = 'rgba(200, 210, 220, 0.18)';
          ctx.fillRect(ox - 0.5, oy - 0.5, 1, 1);
        }

        ctx.restore();
      }

      // Oil deposit (industrial+ visual marker): subtle, not neon.
      if (tile.hasOilDeposit && (opts2?.showOil ?? true)) {
        diamondPath(ctx, screenX, screenY);
        ctx.save();
        ctx.clip();
        const baseSeed = (x * 374761393) ^ (y * 668265263) ^ (state.seed | 0);
        const prng = mulberry32(baseSeed ^ 0x5bd1e995);
        for (let i = 0; i < 5; i++) {
          const cx2 = screenX + TILE_WIDTH * (0.35 + prng() * 0.3);
          const cy2 = screenY + TILE_HEIGHT * (0.45 + prng() * 0.25);
          const rw = 8 + prng() * 16;
          const rh = 6 + prng() * 12;
          const a = (prng() - 0.5) * 1.2;
          ctx.fillStyle = `rgba(8, 10, 12, ${0.35 + prng() * 0.25})`;
          ctx.beginPath();
          ctx.ellipse(cx2, cy2, rw, rh, a, 0, Math.PI * 2);
          ctx.fill();
          // sheen
          ctx.fillStyle = 'rgba(170, 190, 210, 0.10)';
          ctx.beginPath();
          ctx.ellipse(cx2 - rw * 0.25, cy2 - rh * 0.25, rw * 0.45, rh * 0.35, a, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    },

    drawForestOverlay: (
      ctx: CanvasRenderingContext2D,
      screenX: number,
      screenY: number,
      x: number,
      y: number,
      density: number,
      nowSeconds: number,
      timeSetting: 'day' | 'dusk' | 'night' | 'dynamic'
    ): void => {
      const tod = resolveTimeOfDay(timeSetting, nowSeconds);
      const light = lightingFor(tod);
      // Ground shadow tint to "seat" forests into the terrain.
      const strength = clamp01(density / 100);
      diamondPath(ctx, screenX, screenY);
      ctx.save();
      ctx.clip();
      ctx.fillStyle = `rgba(10, 18, 12, ${0.10 + strength * 0.18 * (1 - light.ambient)})`;
      ctx.fillRect(screenX - 10, screenY - 10, TILE_WIDTH + 20, TILE_HEIGHT + 20);

      // Canopy mottling (cheap): a few soft ellipses
      const baseSeed = (x * 2654435761) ^ (y * 1597334677) ^ (state.seed | 0);
      const prng = mulberry32(baseSeed);
      for (let i = 0; i < 5; i++) {
        const cx = screenX + TILE_WIDTH * (0.2 + prng() * 0.6);
        const cy = screenY + TILE_HEIGHT * (0.25 + prng() * 0.55);
        const rx = 6 + prng() * 12;
        const ry = 4 + prng() * 8;
        ctx.fillStyle = `rgba(5, 10, 7, ${0.10 + prng() * 0.10})`;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, (prng() - 0.5) * 1.0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    },

    drawWaterTile: (
      ctx: CanvasRenderingContext2D,
      screenX: number,
      screenY: number,
      x: number,
      y: number,
      depth: number,
      adjacentWater: Adjacent4,
      adjacentLand: Adjacent4,
      nowSeconds: number,
      timeSetting: 'day' | 'dusk' | 'night' | 'dynamic'
    ): void => {
      const patterns = ensurePatterns(state);
      const tod = resolveTimeOfDay(timeSetting, nowSeconds);
      const light = lightingFor(tod);

      // Depth normalization (0 shoreline -> 1 deep)
      const d = clamp01(depth / 12);

      // Base water color: less saturated near shore, darker in deeper water.
      const baseHue = tod === 'night' ? 205 : tod === 'dusk' ? 200 : 195;
      const sat = lerp(0.35, light.waterSat, d);
      const lum = lerp(0.33, light.waterLight, d);

      diamondPath(ctx, screenX, screenY);
      ctx.save();
      ctx.clip();

      ctx.fillStyle = hsl(baseHue, sat, lum, 1);
      ctx.fillRect(screenX - 10, screenY - 10, TILE_WIDTH + 20, TILE_HEIGHT + 20);

      // Animated wave lighting (subtle)
      const wave = Math.sin((x + y) * 0.9 + nowSeconds * 1.6) * 0.5 + state.noise2D(x * 0.15, y * 0.15) * 0.5;
      const waveAlpha = 0.08 + d * 0.06;
      ctx.fillStyle = `rgba(255,255,255,${clamp01(waveAlpha + wave * 0.04)})`;
      ctx.fillRect(screenX - 10, screenY - 10, TILE_WIDTH + 20, TILE_HEIGHT + 20);

      // Water surface detail pattern
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = patterns.waterDetail;
      ctx.fillRect(screenX - 10, screenY - 10, TILE_WIDTH + 20, TILE_HEIGHT + 20);
      ctx.globalAlpha = 1;

      // Shoreline foam (only where adjacent land exists)
      const foam = (edge: 'north' | 'east' | 'south' | 'west') => {
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1.4;
        ctx.lineCap = 'round';
        const t = nowSeconds * 2.0 + (x + y) * 0.5;
        const jitter = Math.sin(t) * 1.2;
        ctx.beginPath();
        switch (edge) {
          case 'north':
            ctx.moveTo(screenX + TILE_WIDTH * 0.15, screenY + TILE_HEIGHT * 0.45 + jitter);
            ctx.quadraticCurveTo(screenX + TILE_WIDTH * 0.5, screenY + TILE_HEIGHT * 0.20, screenX + TILE_WIDTH * 0.85, screenY + TILE_HEIGHT * 0.45 - jitter);
            break;
          case 'east':
            ctx.moveTo(screenX + TILE_WIDTH * 0.55 + jitter, screenY + TILE_HEIGHT * 0.12);
            ctx.quadraticCurveTo(screenX + TILE_WIDTH * 0.86, screenY + TILE_HEIGHT * 0.5, screenX + TILE_WIDTH * 0.55 - jitter, screenY + TILE_HEIGHT * 0.88);
            break;
          case 'south':
            ctx.moveTo(screenX + TILE_WIDTH * 0.15, screenY + TILE_HEIGHT * 0.55 + jitter);
            ctx.quadraticCurveTo(screenX + TILE_WIDTH * 0.5, screenY + TILE_HEIGHT * 0.85, screenX + TILE_WIDTH * 0.85, screenY + TILE_HEIGHT * 0.55 - jitter);
            break;
          case 'west':
            ctx.moveTo(screenX + TILE_WIDTH * 0.45 + jitter, screenY + TILE_HEIGHT * 0.12);
            ctx.quadraticCurveTo(screenX + TILE_WIDTH * 0.14, screenY + TILE_HEIGHT * 0.5, screenX + TILE_WIDTH * 0.45 - jitter, screenY + TILE_HEIGHT * 0.88);
            break;
        }
        ctx.stroke();

        // secondary, thinner foam band
        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        ctx.lineWidth = 0.9;
        ctx.stroke();
      };

      if (adjacentLand.north) foam('north');
      if (adjacentLand.east) foam('east');
      if (adjacentLand.south) foam('south');
      if (adjacentLand.west) foam('west');

      ctx.restore();

      // Edge stroke (very subtle)
      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.lineWidth = 0.5;
      diamondPath(ctx, screenX, screenY);
      ctx.stroke();

      // Seam darkening when surrounded by land-ish edges (small AO hint)
      const seam = (!adjacentWater.north ? 1 : 0) + (!adjacentWater.east ? 1 : 0) + (!adjacentWater.south ? 1 : 0) + (!adjacentWater.west ? 1 : 0);
      if (seam >= 3) {
        ctx.save();
        diamondPath(ctx, screenX, screenY);
        ctx.clip();
        ctx.fillStyle = 'rgba(0,0,0,0.10)';
        ctx.fillRect(screenX - 10, screenY - 10, TILE_WIDTH + 20, TILE_HEIGHT + 20);
        ctx.restore();
      }
    },

    drawBeachOnWater: (
      ctx: CanvasRenderingContext2D,
      screenX: number,
      screenY: number,
      adjacentLand: Adjacent4,
      nowSeconds: number,
      timeSetting: 'day' | 'dusk' | 'night' | 'dynamic'
    ): void => {
      const patterns = ensurePatterns(state);
      const tod = resolveTimeOfDay(timeSetting, nowSeconds);
      const light = lightingFor(tod);

      // Beaches are rendered as wet-sand near shoreline and drier sand further in.
      diamondPath(ctx, screenX, screenY);
      ctx.save();
      ctx.clip();

      // Wet sand band
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = patterns.wetSand;
      ctx.fillRect(screenX - 10, screenY - 10, TILE_WIDTH + 20, TILE_HEIGHT + 20);

      // Dry sand lift (slightly)
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = patterns.sand;
      ctx.fillRect(screenX - 10, screenY - 10, TILE_WIDTH + 20, TILE_HEIGHT + 20);
      ctx.globalAlpha = 1;

      // Directional shaping: only brighten the edges that touch land.
      const edgeTint = (edge: 'north' | 'east' | 'south' | 'west') => {
        ctx.fillStyle = `rgba(255, 255, 255, ${0.08 * light.sun})`;
        ctx.beginPath();
        switch (edge) {
          case 'north':
            ctx.moveTo(screenX + TILE_WIDTH / 2, screenY);
            ctx.lineTo(screenX + TILE_WIDTH * 0.9, screenY + TILE_HEIGHT * 0.45);
            ctx.lineTo(screenX + TILE_WIDTH * 0.1, screenY + TILE_HEIGHT * 0.45);
            break;
          case 'east':
            ctx.moveTo(screenX + TILE_WIDTH, screenY + TILE_HEIGHT / 2);
            ctx.lineTo(screenX + TILE_WIDTH * 0.55, screenY + TILE_HEIGHT * 0.9);
            ctx.lineTo(screenX + TILE_WIDTH * 0.55, screenY + TILE_HEIGHT * 0.1);
            break;
          case 'south':
            ctx.moveTo(screenX + TILE_WIDTH / 2, screenY + TILE_HEIGHT);
            ctx.lineTo(screenX + TILE_WIDTH * 0.9, screenY + TILE_HEIGHT * 0.55);
            ctx.lineTo(screenX + TILE_WIDTH * 0.1, screenY + TILE_HEIGHT * 0.55);
            break;
          case 'west':
            ctx.moveTo(screenX, screenY + TILE_HEIGHT / 2);
            ctx.lineTo(screenX + TILE_WIDTH * 0.45, screenY + TILE_HEIGHT * 0.9);
            ctx.lineTo(screenX + TILE_WIDTH * 0.45, screenY + TILE_HEIGHT * 0.1);
            break;
        }
        ctx.closePath();
        ctx.fill();
      };

      if (adjacentLand.north) edgeTint('north');
      if (adjacentLand.east) edgeTint('east');
      if (adjacentLand.south) edgeTint('south');
      if (adjacentLand.west) edgeTint('west');

      // Micro foam sparkle on the water-facing edge (subtle)
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 5]);
      ctx.beginPath();
      ctx.moveTo(screenX + TILE_WIDTH * 0.18, screenY + TILE_HEIGHT * 0.5);
      ctx.lineTo(screenX + TILE_WIDTH * 0.82, screenY + TILE_HEIGHT * 0.5);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.restore();
    },
  };
}

