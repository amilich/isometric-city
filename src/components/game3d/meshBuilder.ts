// Geometry generation: turns the tile grid into real 3D triangles.
//
// Vertex layout (12 floats, interleaved):
//   position (3) | normal (3) | color (3) | uv (2) | material (1)
//
// The material float packs two things (see `material()` below): a surface flag
// that tells the fragment shader how to shade the face (windows on facades,
// lane markings on roads, ...) and the atlas layer holding its texture.

import { Tile } from '@/types/game';
import { BuildingType } from '@/games/isocity/types';
import { getBuildingSize } from '@/lib/simulation';
import { FloatArrayBuilder } from './glUtils';
import {
  getBuilding3DSpec,
  getBuildingTextures,
  getPlazaSurface,
  hexToRgb,
  tileHash,
  NON_VOLUME_TYPES,
} from './buildingModels';
import { TEX } from './textureAtlas';

export const FLOATS_PER_VERTEX = 12;

export const SURFACE = {
  PLAIN: 0,
  FACADE: 1,
  ROAD: 2,
  GRASS: 3,
  ROOF: 4,
  CONCRETE: 5,
} as const;

/** Must match MATERIAL_STRIDE in the shaders. */
const MATERIAL_STRIDE = 8;

/** Pack a surface flag and an atlas layer (TEX.NONE for untextured) into one float. */
export const material = (flag: number, layer: number = TEX.NONE): number => {
  return flag + (layer + 1) * MATERIAL_STRIDE;
};

export interface CityMesh {
  /** Interleaved opaque geometry. */
  opaque: Float32Array;
  /** Interleaved water surface geometry (drawn with the animated water shader). */
  water: Float32Array;
  /** Vertex counts. */
  opaqueVertices: number;
  waterVertices: number;
}

type RGB = [number, number, number];

const GRASS_COLORS: RGB[] = [
  [0.38, 0.50, 0.30],
  [0.42, 0.54, 0.32],
  [0.34, 0.45, 0.27],
  [0.45, 0.55, 0.35],
  [0.36, 0.47, 0.33],
];
const DIRT: RGB = [0.42, 0.35, 0.28];
const ASPHALT: RGB = [0.22, 0.22, 0.23];
const SIDEWALK: RGB = [0.62, 0.61, 0.58];
const RAIL_BED: RGB = [0.33, 0.29, 0.26];
const RAIL_METAL: RGB = [0.52, 0.52, 0.55];
const WATER: RGB = [0.06, 0.21, 0.32];
const TRUNK: RGB = [0.35, 0.25, 0.17];
const LEAF_COLORS: RGB[] = [
  [0.19, 0.34, 0.20],
  [0.24, 0.40, 0.23],
  [0.28, 0.44, 0.26],
  [0.16, 0.30, 0.18],
  [0.31, 0.42, 0.24],
];

class Geometry {
  private builder = new FloatArrayBuilder(1 << 16);
  vertices = 0;

  private vertex(x: number, y: number, z: number, nx: number, ny: number, nz: number, color: RGB, u: number, v: number, flag: number): void {
    this.builder.push(x, y, z, nx, ny, nz, color[0], color[1], color[2], u, v, flag);
    this.vertices++;
  }

  /** Add a quad (counter-clockwise when viewed from the normal side). */
  quad(
    a: readonly [number, number, number],
    b: readonly [number, number, number],
    c: readonly [number, number, number],
    d: readonly [number, number, number],
    color: RGB,
    flag: number,
    uScale = 1,
    vScale = 1
  ): void {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;

    this.vertex(a[0], a[1], a[2], nx, ny, nz, color, 0, 0, flag);
    this.vertex(b[0], b[1], b[2], nx, ny, nz, color, uScale, 0, flag);
    this.vertex(c[0], c[1], c[2], nx, ny, nz, color, uScale, vScale, flag);
    this.vertex(a[0], a[1], a[2], nx, ny, nz, color, 0, 0, flag);
    this.vertex(c[0], c[1], c[2], nx, ny, nz, color, uScale, vScale, flag);
    this.vertex(d[0], d[1], d[2], nx, ny, nz, color, 0, vScale, flag);
  }

  triangle(
    a: readonly [number, number, number],
    b: readonly [number, number, number],
    c: readonly [number, number, number],
    color: RGB,
    flag: number
  ): void {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    this.vertex(a[0], a[1], a[2], nx, ny, nz, color, 0, 0, flag);
    this.vertex(b[0], b[1], b[2], nx, ny, nz, color, 1, 0, flag);
    this.vertex(c[0], c[1], c[2], nx, ny, nz, color, 0.5, 1, flag);
  }

  /** Horizontal quad at height y spanning [x0,x1] x [z0,z1]. */
  ground(x0: number, z0: number, x1: number, z1: number, y: number, color: RGB, flag: number, uScale = 1, vScale = 1): void {
    this.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], color, flag, uScale, vScale);
  }

  /** Axis-aligned box; walls use wallFlag, the top face uses roof color. */
  box(
    cx: number,
    cz: number,
    sx: number,
    sz: number,
    y0: number,
    y1: number,
    wall: RGB,
    roof: RGB,
    wallFlag: number,
    roofFlag: number = material(SURFACE.ROOF, TEX.ROOF_GRAVEL)
  ): void {
    const x0 = cx - sx / 2, x1 = cx + sx / 2;
    const z0 = cz - sz / 2, z1 = cz + sz / 2;
    const wallHeight = y1 - y0;
    // +z / -z / +x / -x walls, uv.x spans wall width so windows stay square
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], wall, wallFlag, sx, wallHeight);
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], wall, wallFlag, sx, wallHeight);
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], wall, wallFlag, sz, wallHeight);
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], wall, wallFlag, sz, wallHeight);
    this.ground(x0, z0, x1, z1, y1, roof, roofFlag, sx, sz);
  }

  /** Regular prism (cylinder approximation) with a flat cap. */
  prism(cx: number, cz: number, radius: number, y0: number, y1: number, sides: number, wall: RGB, cap: RGB): void {
    for (let i = 0; i < sides; i++) {
      const a0 = (i / sides) * Math.PI * 2;
      const a1 = ((i + 1) / sides) * Math.PI * 2;
      const x0 = cx + Math.cos(a0) * radius, z0 = cz + Math.sin(a0) * radius;
      const x1 = cx + Math.cos(a1) * radius, z1 = cz + Math.sin(a1) * radius;
      this.quad([x0, y0, z0], [x1, y0, z1], [x1, y1, z1], [x0, y1, z0], wall, SURFACE.PLAIN, (2 * Math.PI * radius) / sides, y1 - y0);
      this.triangle([x0, y1, z0], [x1, y1, z1], [cx, y1, cz], cap, SURFACE.PLAIN);
    }
  }

  /** Cone, used for tree canopies and spires. */
  cone(cx: number, cz: number, radius: number, y0: number, y1: number, sides: number, color: RGB): void {
    for (let i = 0; i < sides; i++) {
      const a0 = (i / sides) * Math.PI * 2;
      const a1 = ((i + 1) / sides) * Math.PI * 2;
      this.triangle(
        [cx + Math.cos(a0) * radius, y0, cz + Math.sin(a0) * radius],
        [cx + Math.cos(a1) * radius, y0, cz + Math.sin(a1) * radius],
        [cx, y1, cz],
        color,
        SURFACE.PLAIN
      );
    }
  }

  /** Dome approximated with stacked rings. */
  dome(cx: number, cz: number, radius: number, y0: number, height: number, rings = 4, sides = 12, color: RGB = [1, 1, 1]): void {
    for (let r = 0; r < rings; r++) {
      const t0 = r / rings, t1 = (r + 1) / rings;
      const r0 = radius * Math.cos(t0 * Math.PI / 2);
      const r1 = radius * Math.cos(t1 * Math.PI / 2);
      const h0 = y0 + height * Math.sin(t0 * Math.PI / 2);
      const h1 = y0 + height * Math.sin(t1 * Math.PI / 2);
      for (let i = 0; i < sides; i++) {
        const a0 = (i / sides) * Math.PI * 2;
        const a1 = ((i + 1) / sides) * Math.PI * 2;
        this.quad(
          [cx + Math.cos(a0) * r0, h0, cz + Math.sin(a0) * r0],
          [cx + Math.cos(a1) * r0, h0, cz + Math.sin(a1) * r0],
          [cx + Math.cos(a1) * r1, h1, cz + Math.sin(a1) * r1],
          [cx + Math.cos(a0) * r1, h1, cz + Math.sin(a0) * r1],
          color,
          SURFACE.PLAIN
        );
      }
    }
  }

  /** Gable roof spanning sx (ridge runs along z). */
  gableRoof(
    cx: number,
    cz: number,
    sx: number,
    sz: number,
    y0: number,
    ridgeHeight: number,
    color: RGB,
    flag: number = material(SURFACE.ROOF, TEX.ROOF_SHINGLE)
  ): void {
    const x0 = cx - sx / 2, x1 = cx + sx / 2;
    const z0 = cz - sz / 2, z1 = cz + sz / 2;
    const yr = y0 + ridgeHeight;
    // Two sloped faces
    this.quad([x0, y0, z1], [cx, yr, z1], [cx, yr, z0], [x0, y0, z0], color, flag, sx * 0.6, sz);
    this.quad([cx, yr, z1], [x1, y0, z1], [x1, y0, z0], [cx, yr, z0], color, flag, sx * 0.6, sz);
    // Gable ends
    this.triangle([x0, y0, z1], [x1, y0, z1], [cx, yr, z1], color, flag);
    this.triangle([x1, y0, z0], [x0, y0, z0], [cx, yr, z0], color, flag);
  }

  data(): Float32Array {
    return this.builder.view();
  }
}

const isType = (grid: Tile[][], gridSize: number, x: number, y: number, type: BuildingType): boolean => {
  if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) return false;
  return grid[y][x].building.type === type;
};

const isRoadLike = (grid: Tile[][], gridSize: number, x: number, y: number): boolean => {
  if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) return false;
  const type = grid[y][x].building.type;
  return type === 'road' || type === 'bridge';
};

const mixColor = (color: RGB, factor: number): RGB => {
  return [color[0] * factor, color[1] * factor, color[2] * factor];
};

/**
 * Per-instance colour drift: a shared palette entry becomes a slightly different
 * shade on every plot, so a street of the same building type does not read as a
 * row of clones.
 */
const weather = (color: RGB, x: number, y: number, salt: number): RGB => {
  const brightness = 0.88 + tileHash(x, y, salt) * 0.24;
  const warmth = (tileHash(x, y, salt + 1) - 0.5) * 0.06;
  const desaturate = 0.12 + tileHash(x, y, salt + 2) * 0.12;
  const luma = color[0] * 0.3 + color[1] * 0.59 + color[2] * 0.11;
  return [
    Math.min(1, Math.max(0, (color[0] + (luma - color[0]) * desaturate + warmth) * brightness)),
    Math.min(1, Math.max(0, (color[1] + (luma - color[1]) * desaturate) * brightness)),
    Math.min(1, Math.max(0, (color[2] + (luma - color[2]) * desaturate - warmth) * brightness)),
  ];
};

const addTree = (geo: Geometry, x: number, y: number, scale = 1): void => {
  const cx = x + 0.3 + tileHash(x, y, 3) * 0.4;
  const cz = y + 0.3 + tileHash(x, y, 4) * 0.4;
  const height = (0.55 + tileHash(x, y, 5) * 0.5) * scale;
  const leaf = LEAF_COLORS[Math.floor(tileHash(x, y, 6) * LEAF_COLORS.length)];
  geo.box(cx, cz, 0.07 * scale, 0.07 * scale, 0, height * 0.4, TRUNK, TRUNK, SURFACE.PLAIN);
  geo.cone(cx, cz, 0.28 * scale, height * 0.3, height * 0.85, 7, leaf);
  geo.cone(cx, cz, 0.2 * scale, height * 0.62, height * 1.25, 7, mixColor(leaf, 1.12));
};

const addRoadTile = (geo: Geometry, grid: Tile[][], gridSize: number, x: number, y: number): void => {
  const northSouth = isRoadLike(grid, gridSize, x, y - 1) || isRoadLike(grid, gridSize, x, y + 1);
  const eastWest = isRoadLike(grid, gridSize, x - 1, y) || isRoadLike(grid, gridSize, x + 1, y);
  const intersection = northSouth && eastWest;

  // Sidewalk pad slightly below road level so kerbs read in 3D
  geo.ground(x, y, x + 1, y + 1, 0.035, SIDEWALK, material(SURFACE.CONCRETE, TEX.PAVING));

  const inset = 0.1;
  const flag = material(intersection ? SURFACE.PLAIN : SURFACE.ROAD, TEX.ASPHALT);
  if (eastWest && !northSouth) {
    // Lanes run along x: uv.y follows the travel direction
    geo.quad(
      [x, 0.05, y + 1 - inset], [x + 1, 0.05, y + 1 - inset], [x + 1, 0.05, y + inset], [x, 0.05, y + inset],
      ASPHALT, flag, 1, 1
    );
  } else if (northSouth && !eastWest) {
    geo.quad(
      [x + inset, 0.05, y + 1], [x + 1 - inset, 0.05, y + 1], [x + 1 - inset, 0.05, y], [x + inset, 0.05, y],
      ASPHALT, flag, 1, 1
    );
  } else {
    geo.ground(x, y, x + 1, y + 1, 0.05, ASPHALT, flag);
  }
};

const addRailTile = (geo: Geometry, grid: Tile[][], gridSize: number, x: number, y: number): void => {
  const northSouth = isType(grid, gridSize, x, y - 1, 'rail') || isType(grid, gridSize, x, y + 1, 'rail');
  geo.ground(x + 0.15, y + 0.15, x + 0.85, y + 0.85, 0.04, RAIL_BED, material(SURFACE.PLAIN, TEX.DIRT));
  const railOffsets = [-0.12, 0.12];
  for (const offset of railOffsets) {
    if (northSouth) {
      geo.box(x + 0.5 + offset, y + 0.5, 0.05, 1, 0.04, 0.1, RAIL_METAL, RAIL_METAL, SURFACE.PLAIN);
    } else {
      geo.box(x + 0.5, y + 0.5 + offset, 1, 0.05, 0.04, 0.1, RAIL_METAL, RAIL_METAL, SURFACE.PLAIN);
    }
  }
};

const addBridgeTile = (geo: Geometry, tile: Tile, x: number, y: number): void => {
  const deckY = 0.55;
  const isNS = tile.building.bridgeOrientation === 'ns';
  const deckColor: RGB = [0.62, 0.60, 0.57];
  const deckFlag = material(SURFACE.PLAIN, TEX.PAVING);
  const roadFlag = material(SURFACE.ROAD, TEX.ASPHALT);
  if (isNS) {
    geo.box(x + 0.5, y + 0.5, 0.8, 1, deckY - 0.08, deckY, deckColor, ASPHALT, deckFlag, roadFlag);
    geo.box(x + 0.5 - 0.42, y + 0.5, 0.06, 1, deckY, deckY + 0.14, deckColor, deckColor, deckFlag, deckFlag);
    geo.box(x + 0.5 + 0.42, y + 0.5, 0.06, 1, deckY, deckY + 0.14, deckColor, deckColor, deckFlag, deckFlag);
  } else {
    geo.box(x + 0.5, y + 0.5, 1, 0.8, deckY - 0.08, deckY, deckColor, ASPHALT, deckFlag, roadFlag);
    geo.box(x + 0.5, y + 0.5 - 0.42, 1, 0.06, deckY, deckY + 0.14, deckColor, deckColor, deckFlag, deckFlag);
    geo.box(x + 0.5, y + 0.5 + 0.42, 1, 0.06, deckY, deckY + 0.14, deckColor, deckColor, deckFlag, deckFlag);
  }
  if (tile.building.bridgePosition !== 'middle' || (x + y) % 3 === 0) {
    geo.box(x + 0.5, y + 0.5, 0.16, 0.16, -0.6, deckY - 0.08, [0.5, 0.49, 0.47], [0.5, 0.49, 0.47], deckFlag, deckFlag);
  }
};

const addBuildingVolume = (geo: Geometry, tile: Tile, x: number, y: number): void => {
  const type = tile.building.type;
  const spec = getBuilding3DSpec(type);
  const size = getBuildingSize(type);
  const footprintW = size.width;
  const footprintH = size.height;
  const cx = x + footprintW / 2;
  const cz = y + footprintH / 2;

  const jitter = (tileHash(x, y, 11) - 0.5) * 2 * spec.variance;
  const levelBoost = 1 + Math.max(0, tile.building.level - 1) * 0.12;
  const progress = tile.building.constructionProgress;
  const underConstruction = progress > 0 && progress < 100;
  const buildFraction = underConstruction ? Math.max(0.12, progress / 100) : 1;
  let height = spec.height * (1 + jitter) * levelBoost * buildFraction;

  const textures = getBuildingTextures(type);
  let wall = weather(hexToRgb(spec.wall), x, y, 60);
  let roof = weather(hexToRgb(spec.roof), x, y, 70);
  let wallFlag = material(spec.windows ? SURFACE.FACADE : SURFACE.PLAIN, textures.wall);
  const roofFlag = material(SURFACE.ROOF, textures.roof);
  if (underConstruction) {
    wall = [0.72, 0.63, 0.45];
    roof = [0.58, 0.5, 0.36];
    wallFlag = material(SURFACE.PLAIN, TEX.CONCRETE_PANEL);
  } else if (tile.building.abandoned) {
    wall = mixColor(wall, 0.62);
    roof = mixColor(roof, 0.6);
    wallFlag = material(SURFACE.PLAIN, textures.wall);
  }

  const sx = Math.max(0.2, footprintW - spec.inset * 2);
  const sz = Math.max(0.2, footprintH - spec.inset * 2);

  // Ground pad under the building so it does not float on grass
  geo.ground(x, y, x + footprintW, y + footprintH, 0.02, SIDEWALK, material(SURFACE.CONCRETE, TEX.PAVING), footprintW, footprintH);

  switch (spec.style) {
    case 'house': {
      const wallHeight = height * 0.62;
      geo.box(cx, cz, sx, sz, 0, wallHeight, wall, roof, wallFlag, roofFlag);
      geo.gableRoof(cx, cz, sx * 1.08, sz * 1.08, wallHeight, height - wallHeight, roof, roofFlag);
      break;
    }
    case 'tower': {
      const tiers = [
        { h: 0.6, s: 1.0 },
        { h: 0.28, s: 0.78 },
        { h: 0.12, s: 0.52 },
      ];
      let base = 0;
      for (const tier of tiers) {
        const top = base + height * tier.h;
        geo.box(cx, cz, sx * tier.s, sz * tier.s, base, top, wall, roof, wallFlag, roofFlag);
        base = top;
      }
      // Rooftop mast
      geo.box(cx, cz, 0.06, 0.06, base, base + height * 0.08, [0.4, 0.42, 0.45], [0.4, 0.42, 0.45], SURFACE.PLAIN);
      break;
    }
    case 'slab': {
      geo.box(cx, cz, sx, sz, 0, height, wall, roof, wallFlag, roofFlag);
      // Rooftop HVAC blocks add silhouette detail
      const units = Math.min(4, Math.floor(footprintW * footprintH));
      for (let i = 0; i < units; i++) {
        const ox = cx + (tileHash(x, y, 20 + i) - 0.5) * sx * 0.6;
        const oz = cz + (tileHash(x, y, 40 + i) - 0.5) * sz * 0.6;
        geo.box(ox, oz, 0.22, 0.22, height, height + 0.12, [0.6, 0.6, 0.62], [0.55, 0.55, 0.58], SURFACE.PLAIN);
      }
      break;
    }
    case 'tank': {
      const radius = Math.min(sx, sz) / 2;
      geo.prism(cx, cz, radius * 0.32, 0, height * 0.55, 8, [0.55, 0.55, 0.58], [0.5, 0.5, 0.53]);
      geo.prism(cx, cz, radius, height * 0.55, height, 12, wall, roof);
      break;
    }
    case 'dome': {
      const bodyHeight = height * 0.55;
      geo.box(cx, cz, sx, sz, 0, bodyHeight, wall, roof, wallFlag, roofFlag);
      geo.dome(cx, cz, Math.min(sx, sz) * 0.5, bodyHeight, height - bodyHeight, 4, 14, roof);
      break;
    }
    case 'plaza': {
      height = Math.min(height, 0.5);
      geo.ground(
        x + 0.05, y + 0.05, x + footprintW - 0.05, y + footprintH - 0.05, 0.03,
        mixColor(wall, 0.9), material(SURFACE.PLAIN, TEX.PAVING), footprintW, footprintH
      );
      geo.box(cx, cz, sx * 0.4, sz * 0.4, 0, height, wall, roof, material(SURFACE.PLAIN, textures.wall), roofFlag);
      break;
    }
    case 'block':
    default: {
      geo.box(cx, cz, sx, sz, 0, height, wall, roof, wallFlag, roofFlag);
      if (height > 1.4) {
        // Parapet ring
        geo.box(cx, cz, sx, sz, height, height + 0.08, mixColor(roof, 1.15), mixColor(roof, 1.1), SURFACE.PLAIN);
      }
      break;
    }
  }

  if (tile.building.onFire) {
    // Simple flame cone so fires are visible in 3D too
    geo.cone(cx, cz, Math.min(sx, sz) * 0.35, height, height + 0.7, 6, [0.95, 0.42, 0.12]);
  }
};

export interface BuildCityMeshOptions {
  grid: Tile[][];
  gridSize: number;
}

/** Build the full static city mesh. Runs when the grid changes, not per frame. */
export const buildCityMesh = ({ grid, gridSize }: BuildCityMeshOptions): CityMesh => {
  const opaque = new Geometry();
  const water = new Geometry();

  for (let y = 0; y < gridSize; y++) {
    const row = grid[y];
    if (!row) continue;
    for (let x = 0; x < gridSize; x++) {
      const tile = row[x];
      if (!tile) continue;
      const type = tile.building.type;

      if (type === 'water') {
        water.ground(x, y, x + 1, y + 1, -0.02, WATER, SURFACE.PLAIN);
        continue;
      }

      // Terrain under everything else
      const grass = GRASS_COLORS[Math.floor(tileHash(x, y, 1) * GRASS_COLORS.length)];
      opaque.ground(x, y, x + 1, y + 1, 0, grass, material(SURFACE.GRASS, TEX.GRASS));

      switch (type) {
        case 'road':
          addRoadTile(opaque, grid, gridSize, x, y);
          break;
        case 'rail':
          addRailTile(opaque, grid, gridSize, x, y);
          break;
        case 'bridge':
          water.ground(x, y, x + 1, y + 1, -0.02, WATER, SURFACE.PLAIN);
          addBridgeTile(opaque, tile, x, y);
          break;
        case 'tree':
          addTree(opaque, x, y);
          break;
        case 'empty':
        case 'grass':
          if (tileHash(x, y, 2) > 0.93) addTree(opaque, x, y, 0.6);
          break;
        default: {
          const plaza = getPlazaSurface(type);
          if (plaza) {
            const size = getBuildingSize(type);
            opaque.ground(
              x, y, x + size.width, y + size.height, 0.02,
              hexToRgb(plaza.color), material(SURFACE.PLAIN, plaza.texture), size.width, size.height
            );
            // Scatter a few trees / props across park footprints
            for (let py = 0; py < size.height; py++) {
              for (let px = 0; px < size.width; px++) {
                if (tileHash(x + px, y + py, 7) > 0.55) addTree(opaque, x + px, y + py, 0.7);
              }
            }
          } else if (!NON_VOLUME_TYPES.has(type)) {
            addBuildingVolume(opaque, tile, x, y);
          }
          break;
        }
      }
    }
  }

  // Terrain skirt so the map reads as a solid slab rather than a floating plane
  const edge = gridSize;
  const skirt = material(SURFACE.PLAIN, TEX.DIRT);
  opaque.quad([0, 0, edge], [edge, 0, edge], [edge, -2, edge], [0, -2, edge], DIRT, skirt, edge, 2);
  opaque.quad([edge, 0, 0], [0, 0, 0], [0, -2, 0], [edge, -2, 0], DIRT, skirt, edge, 2);
  opaque.quad([edge, 0, edge], [edge, 0, 0], [edge, -2, 0], [edge, -2, edge], DIRT, skirt, edge, 2);
  opaque.quad([0, 0, 0], [0, 0, edge], [0, -2, edge], [0, -2, 0], DIRT, skirt, edge, 2);

  return {
    opaque: opaque.data(),
    water: water.data(),
    opaqueVertices: opaque.vertices,
    waterVertices: water.vertices,
  };
};
