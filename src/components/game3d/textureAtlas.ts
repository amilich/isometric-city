// Procedural material textures for the 3D city.
//
// Every layer is generated with the 2D canvas API at startup and uploaded as a
// single GL_TEXTURE_2D_ARRAY, so the renderer stays asset-free while facades,
// roofs and ground surfaces get real surface detail instead of flat colour.
//
// Conventions for each layer:
//   rgb   - a detail map centred on 0.5; the shader multiplies albedo by rgb*2
//   alpha - window mask (1 where a facade has glass), 0 for everything else
//
// Wall textures share one window grid (WINDOW_GRID bays/floors per world unit)
// so the shader can light individual windows at night.

export const TEXTURE_SIZE = 256;
export const WINDOW_GRID = 3;

export const TEX = {
  NONE: -1,
  CONCRETE_PANEL: 0,
  BRICK: 1,
  GLASS: 2,
  STUCCO: 3,
  METAL_PANEL: 4,
  ROOF_GRAVEL: 5,
  ROOF_SHINGLE: 6,
  ROOF_METAL: 7,
  ASPHALT: 8,
  GRASS: 9,
  PAVING: 10,
  DIRT: 11,
} as const;

export const TEXTURE_LAYERS = 12;

type Ctx = CanvasRenderingContext2D;

/** Deterministic pseudo random so textures are identical across reloads. */
const makeRandom = (seed: number): () => number => {
  let state = seed | 0 || 1;
  return () => {
    state = (state * 1664525 + 1013904223) | 0;
    return ((state >>> 8) & 0xffffff) / 0x1000000;
  };
};

const fill = (ctx: Ctx, gray: number): void => {
  ctx.fillStyle = `rgb(${gray},${gray},${gray})`;
  ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
};

/** Per-pixel grain. Random at pixel scale, so it tiles without visible seams. */
const grain = (ctx: Ctx, amount: number, seed: number, tint: [number, number, number] = [1, 1, 1]): void => {
  const image = ctx.getImageData(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
  const random = makeRandom(seed);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    const n = (random() - 0.5) * amount;
    data[i] = Math.max(0, Math.min(255, data[i] + n * tint[0]));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n * tint[1]));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n * tint[2]));
  }
  ctx.putImageData(image, 0, 0);
};

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Glass rectangles of the layer currently being painted; becomes the alpha mask. */
let windowRects: Rect[] = [];

/** Windows on the shared WINDOW_GRID; each pane is recorded for the alpha mask. */
const windows = (ctx: Ctx, options: { width: number; height: number; frame: number; sill: boolean }): void => {
  const cell = TEXTURE_SIZE / WINDOW_GRID;
  const w = cell * options.width;
  const h = cell * options.height;
  for (let row = 0; row < WINDOW_GRID; row++) {
    for (let col = 0; col < WINDOW_GRID; col++) {
      const x = col * cell + (cell - w) / 2;
      const y = row * cell + (cell - h) / 2;
      if (options.frame > 0) {
        ctx.fillStyle = 'rgba(210,206,198,1)';
        ctx.fillRect(x - options.frame, y - options.frame, w + options.frame * 2, h + options.frame * 2);
      }
      // Glass itself: dark detail plus alpha=1 so the shader can treat it as a window
      ctx.fillStyle = 'rgba(74,84,96,1)';
      ctx.fillRect(x, y, w, h);
      windowRects.push({ x, y, w, h });
      const gradient = ctx.createLinearGradient(x, y, x + w, y + h);
      gradient.addColorStop(0, 'rgba(150,168,184,0.55)');
      gradient.addColorStop(1, 'rgba(40,48,58,0.35)');
      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, w, h);
      if (options.sill) {
        ctx.fillStyle = 'rgba(196,192,184,1)';
        ctx.fillRect(x - options.frame, y + h + options.frame, w + options.frame * 2, 3);
      }
    }
  }
};

const concretePanel = (ctx: Ctx): void => {
  fill(ctx, 128);
  grain(ctx, 26, 11);
  // Precast panel joints
  ctx.strokeStyle = 'rgba(90,90,92,0.55)';
  ctx.lineWidth = 2;
  const cell = TEXTURE_SIZE / WINDOW_GRID;
  for (let i = 0; i <= WINDOW_GRID; i++) {
    ctx.beginPath();
    ctx.moveTo(0, i * cell);
    ctx.lineTo(TEXTURE_SIZE, i * cell);
    ctx.moveTo(i * cell, 0);
    ctx.lineTo(i * cell, TEXTURE_SIZE);
    ctx.stroke();
  }
  windows(ctx, { width: 0.52, height: 0.5, frame: 4, sill: true });
};

const brick = (ctx: Ctx): void => {
  fill(ctx, 120);
  const rows = 24;
  const rowHeight = TEXTURE_SIZE / rows;
  const brickWidth = TEXTURE_SIZE / 8;
  const random = makeRandom(97);
  for (let row = 0; row < rows; row++) {
    const offset = (row % 2) * (brickWidth / 2);
    for (let col = -1; col < 9; col++) {
      const shade = 108 + random() * 34;
      ctx.fillStyle = `rgb(${shade},${shade * 0.94},${shade * 0.9})`;
      ctx.fillRect(col * brickWidth + offset + 1, row * rowHeight + 1, brickWidth - 2, rowHeight - 2);
    }
  }
  grain(ctx, 16, 23);
  windows(ctx, { width: 0.42, height: 0.46, frame: 5, sill: true });
};

const glassCurtain = (ctx: Ctx): void => {
  fill(ctx, 118);
  const cell = TEXTURE_SIZE / WINDOW_GRID;
  // Spandrel bands between floors
  for (let row = 0; row < WINDOW_GRID; row++) {
    ctx.fillStyle = 'rgba(104,112,120,1)';
    ctx.fillRect(0, row * cell, TEXTURE_SIZE, cell * 0.16);
  }
  windows(ctx, { width: 0.86, height: 0.7, frame: 2, sill: false });
  // Vertical mullions across the glass
  ctx.fillStyle = 'rgba(150,156,162,0.85)';
  for (let i = 0; i < WINDOW_GRID * 2; i++) {
    ctx.fillRect((i * TEXTURE_SIZE) / (WINDOW_GRID * 2), 0, 2, TEXTURE_SIZE);
  }
};

const stucco = (ctx: Ctx): void => {
  fill(ctx, 134);
  grain(ctx, 30, 51);
  // Horizontal siding lines
  ctx.strokeStyle = 'rgba(104,100,94,0.35)';
  ctx.lineWidth = 1;
  for (let y = 0; y < TEXTURE_SIZE; y += 16) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(TEXTURE_SIZE, y + 0.5);
    ctx.stroke();
  }
  windows(ctx, { width: 0.34, height: 0.4, frame: 6, sill: true });
};

const metalPanel = (ctx: Ctx): void => {
  fill(ctx, 128);
  // Corrugated ribs
  for (let x = 0; x < TEXTURE_SIZE; x++) {
    const shade = 128 + Math.sin((x / TEXTURE_SIZE) * Math.PI * 2 * 16) * 26;
    ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
    ctx.fillRect(x, 0, 1, TEXTURE_SIZE);
  }
  grain(ctx, 10, 71);
  // Strip windows high on the wall
  ctx.fillStyle = 'rgba(78,88,98,1)';
  const cell = TEXTURE_SIZE / WINDOW_GRID;
  for (let row = 0; row < WINDOW_GRID; row++) {
    const strip = { x: cell * 0.12, y: row * cell + cell * 0.18, w: cell * (WINDOW_GRID - 0.24), h: cell * 0.16 };
    ctx.fillRect(strip.x, strip.y, strip.w, strip.h);
    windowRects.push(strip);
  }
};

const roofGravel = (ctx: Ctx): void => {
  fill(ctx, 126);
  grain(ctx, 46, 131);
  // Membrane seams
  ctx.strokeStyle = 'rgba(96,96,98,0.5)';
  ctx.lineWidth = 3;
  for (let y = 0; y < TEXTURE_SIZE; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y + 1.5);
    ctx.lineTo(TEXTURE_SIZE, y + 1.5);
    ctx.stroke();
  }
};

const roofShingle = (ctx: Ctx): void => {
  fill(ctx, 120);
  const rows = 16;
  const rowHeight = TEXTURE_SIZE / rows;
  const tabWidth = TEXTURE_SIZE / 10;
  const random = makeRandom(211);
  for (let row = 0; row < rows; row++) {
    const offset = (row % 2) * (tabWidth / 2);
    for (let col = -1; col < 11; col++) {
      const shade = 108 + random() * 40;
      ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
      ctx.fillRect(col * tabWidth + offset, row * rowHeight, tabWidth - 2, rowHeight - 1);
    }
    ctx.fillStyle = 'rgba(80,80,80,0.45)';
    ctx.fillRect(0, row * rowHeight + rowHeight - 2, TEXTURE_SIZE, 2);
  }
  grain(ctx, 14, 233);
};

const roofMetal = (ctx: Ctx): void => {
  fill(ctx, 130);
  for (let x = 0; x < TEXTURE_SIZE; x += 32) {
    ctx.fillStyle = 'rgba(160,164,168,0.9)';
    ctx.fillRect(x, 0, 4, TEXTURE_SIZE);
    ctx.fillStyle = 'rgba(96,98,102,0.7)';
    ctx.fillRect(x + 4, 0, 2, TEXTURE_SIZE);
  }
  grain(ctx, 12, 307);
};

const asphalt = (ctx: Ctx): void => {
  fill(ctx, 122);
  grain(ctx, 40, 401);
  // Patches and cracks
  const random = makeRandom(409);
  ctx.strokeStyle = 'rgba(96,96,98,0.6)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 26; i++) {
    const x = random() * TEXTURE_SIZE;
    const y = random() * TEXTURE_SIZE;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (random() - 0.5) * 26, y + (random() - 0.5) * 26);
    ctx.stroke();
  }
};

const grass = (ctx: Ctx): void => {
  fill(ctx, 128);
  grain(ctx, 44, 503, [0.7, 1.2, 0.6]);
  const random = makeRandom(521);
  // Short blades give the lawn some direction
  ctx.lineWidth = 1;
  for (let i = 0; i < 900; i++) {
    const x = random() * TEXTURE_SIZE;
    const y = random() * TEXTURE_SIZE;
    const light = random() > 0.5;
    ctx.strokeStyle = light ? 'rgba(168,180,150,0.5)' : 'rgba(88,102,78,0.5)';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (random() - 0.5) * 3, y - 2 - random() * 3);
    ctx.stroke();
  }
};

const paving = (ctx: Ctx): void => {
  fill(ctx, 132);
  grain(ctx, 20, 601);
  ctx.strokeStyle = 'rgba(92,92,90,0.55)';
  ctx.lineWidth = 2;
  const step = TEXTURE_SIZE / 4;
  for (let i = 0; i <= 4; i++) {
    ctx.beginPath();
    ctx.moveTo(0, i * step);
    ctx.lineTo(TEXTURE_SIZE, i * step);
    ctx.moveTo(i * step, 0);
    ctx.lineTo(i * step, TEXTURE_SIZE);
    ctx.stroke();
  }
};

const dirt = (ctx: Ctx): void => {
  fill(ctx, 128);
  grain(ctx, 52, 701, [1.2, 1.0, 0.8]);
  const random = makeRandom(719);
  for (let i = 0; i < 220; i++) {
    const x = random() * TEXTURE_SIZE;
    const y = random() * TEXTURE_SIZE;
    const r = 1 + random() * 3;
    ctx.fillStyle = random() > 0.5 ? 'rgba(150,140,124,0.5)' : 'rgba(90,80,68,0.5)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
};

const PAINTERS: Record<number, (ctx: Ctx) => void> = {
  [TEX.CONCRETE_PANEL]: concretePanel,
  [TEX.BRICK]: brick,
  [TEX.GLASS]: glassCurtain,
  [TEX.STUCCO]: stucco,
  [TEX.METAL_PANEL]: metalPanel,
  [TEX.ROOF_GRAVEL]: roofGravel,
  [TEX.ROOF_SHINGLE]: roofShingle,
  [TEX.ROOF_METAL]: roofMetal,
  [TEX.ASPHALT]: asphalt,
  [TEX.GRASS]: grass,
  [TEX.PAVING]: paving,
  [TEX.DIRT]: dirt,
};

/**
 * Render every layer once and pack them into a single RGBA buffer laid out as
 * consecutive images, ready for texImage3D.
 */
const renderAtlasPixels = (): Uint8Array => {
  const canvas = document.createElement('canvas');
  canvas.width = TEXTURE_SIZE;
  canvas.height = TEXTURE_SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2D canvas is not available for texture generation');

  const bytesPerLayer = TEXTURE_SIZE * TEXTURE_SIZE * 4;
  const pixels = new Uint8Array(bytesPerLayer * TEXTURE_LAYERS);

  for (let layer = 0; layer < TEXTURE_LAYERS; layer++) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
    windowRects = [];
    PAINTERS[layer](ctx);

    const image = ctx.getImageData(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
    const data = image.data;
    for (let i = 3; i < data.length; i += 4) data[i] = 0;
    for (const rect of windowRects) {
      const x0 = Math.max(0, Math.round(rect.x));
      const x1 = Math.min(TEXTURE_SIZE, Math.round(rect.x + rect.w));
      const y0 = Math.max(0, Math.round(rect.y));
      const y1 = Math.min(TEXTURE_SIZE, Math.round(rect.y + rect.h));
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) data[(y * TEXTURE_SIZE + x) * 4 + 3] = 255;
      }
    }
    pixels.set(data, layer * bytesPerLayer);
  }

  return pixels;
};

/** Upload the generated layers as a mipmapped 2D texture array. */
export const createMaterialAtlas = (gl: WebGL2RenderingContext): WebGLTexture => {
  const texture = gl.createTexture();
  if (!texture) throw new Error('Failed to create material atlas texture');

  gl.bindTexture(gl.TEXTURE_2D_ARRAY, texture);
  gl.texImage3D(
    gl.TEXTURE_2D_ARRAY, 0, gl.RGBA8,
    TEXTURE_SIZE, TEXTURE_SIZE, TEXTURE_LAYERS, 0,
    gl.RGBA, gl.UNSIGNED_BYTE, renderAtlasPixels()
  );
  gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.REPEAT);

  const anisotropic = gl.getExtension('EXT_texture_filter_anisotropic');
  if (anisotropic) {
    const max = gl.getParameter(anisotropic.MAX_TEXTURE_MAX_ANISOTROPY_EXT) as number;
    gl.texParameterf(gl.TEXTURE_2D_ARRAY, anisotropic.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, max));
  }

  gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
  return texture;
};
