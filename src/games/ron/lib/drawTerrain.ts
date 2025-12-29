/**
 * Rise of Nations - Terrain/Shoreline rendering helpers.
 *
 * Purpose:
 * - Make coastlines look less “flat/cartoon” by adding shallow-water sand tint
 *   + subtle foam along edges where water meets land.
 *
 * This is RoN-specific (so we don’t accidentally change IsoCity’s sidewalk/beach style).
 */

import { TILE_WIDTH, TILE_HEIGHT } from '@/components/game/shared';
import { getDiamondCorners } from '@/components/game/drawing';

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2D(x: number, y: number): number {
  let h = Math.imul(x, 0x1f123bb5) ^ Math.imul(y, 0x6a09e667);
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

type AdjacentLand = { north: boolean; east: boolean; south: boolean; west: boolean };

/**
 * Draw a realistic shoreline on a *water* tile (sand shallows + foam).
 * Call AFTER `drawWaterTile` for best results.
 */
export function drawRoNShorelineOnWater(
  ctx: CanvasRenderingContext2D,
  coords: { screenX: number; screenY: number; gridX: number; gridY: number },
  adjacentLand: AdjacentLand
): void {
  const { screenX, screenY, gridX, gridY } = coords;
  const { north, east, south, west } = adjacentLand;
  if (!north && !east && !south && !west) return;

  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const corners = getDiamondCorners(screenX, screenY, w, h);

  // Clip to diamond
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(corners.top.x, corners.top.y);
  ctx.lineTo(corners.right.x, corners.right.y);
  ctx.lineTo(corners.bottom.x, corners.bottom.y);
  ctx.lineTo(corners.left.x, corners.left.y);
  ctx.closePath();
  ctx.clip();

  const rng = mulberry32(hash2D(gridX, gridY) ^ 0x4f6c1a2b);
  const beachWidth = w * 0.14; // wider than IsoCity “sidewalk” to read as shore in RTS camera

  const sandDry = 'rgba(214, 197, 150, 0.55)';
  const sandWet = 'rgba(168, 152, 110, 0.45)';
  const foam = 'rgba(255, 255, 255, 0.38)';

  // Helper: draw a sand strip from an edge toward tile center with slight waviness.
  const drawEdge = (ax: number, ay: number, bx: number, by: number) => {
    // Inward direction toward center
    const cx = screenX + w / 2;
    const cy = screenY + h / 2;
    const ex = bx - ax;
    const ey = by - ay;
    const el = Math.max(1, Math.hypot(ex, ey));
    const exn = ex / el;
    const eyn = ey / el;

    // Perp direction (roughly inward), then pick the one that points toward center
    let px = -eyn;
    let py = exn;
    const midx = (ax + bx) * 0.5;
    const midy = (ay + by) * 0.5;
    const toCenterX = cx - midx;
    const toCenterY = cy - midy;
    if (px * toCenterX + py * toCenterY < 0) {
      px = -px;
      py = -py;
    }

    // Wavy inner edge points (foam boundary)
    const segments = 5;
    const ptsOuter: Array<{ x: number; y: number }> = [];
    const ptsInner: Array<{ x: number; y: number }> = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const ox = ax + ex * t;
      const oy = ay + ey * t;
      const wave = (rng() - 0.5) * 2.6;
      const innerX = ox + px * (beachWidth + wave);
      const innerY = oy + py * (beachWidth + wave);
      ptsOuter.push({ x: ox, y: oy });
      ptsInner.push({ x: innerX, y: innerY });
    }

    // Sand fill gradient (dry -> wet inward)
    const grad = ctx.createLinearGradient(midx, midy, midx + px * beachWidth, midy + py * beachWidth);
    grad.addColorStop(0, sandDry);
    grad.addColorStop(1, sandWet);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(ptsOuter[0].x, ptsOuter[0].y);
    for (let i = 1; i < ptsOuter.length; i++) ctx.lineTo(ptsOuter[i].x, ptsOuter[i].y);
    for (let i = ptsInner.length - 1; i >= 0; i--) ctx.lineTo(ptsInner[i].x, ptsInner[i].y);
    ctx.closePath();
    ctx.fill();

    // Foam line along inner boundary
    ctx.strokeStyle = foam;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ptsInner[0].x, ptsInner[0].y);
    for (let i = 1; i < ptsInner.length; i++) ctx.lineTo(ptsInner[i].x, ptsInner[i].y);
    ctx.stroke();

    // Tiny speckles (sand grains)
    ctx.fillStyle = 'rgba(80, 70, 45, 0.08)';
    for (let i = 0; i < 14; i++) {
      const t = rng();
      const sx = ax + ex * t + px * (rng() * beachWidth);
      const sy = ay + ey * t + py * (rng() * beachWidth);
      ctx.fillRect(sx, sy, 0.9, 0.9);
    }
  };

  // Map RoN adjacency to diamond edges
  // In RoN, “north/east/south/west” are the same adjacency used elsewhere:
  // - north: x-1 (top-left edge) => left->top
  // - east:  y-1 (top-right edge) => top->right
  // - south: x+1 (bottom-right edge) => right->bottom
  // - west:  y+1 (bottom-left edge) => bottom->left
  if (north) drawEdge(corners.left.x, corners.left.y, corners.top.x, corners.top.y);
  if (east) drawEdge(corners.top.x, corners.top.y, corners.right.x, corners.right.y);
  if (south) drawEdge(corners.right.x, corners.right.y, corners.bottom.x, corners.bottom.y);
  if (west) drawEdge(corners.bottom.x, corners.bottom.y, corners.left.x, corners.left.y);

  ctx.restore();
}

