import { CoasterTile } from '@/games/coaster/types';
import { TILE_WIDTH, TILE_HEIGHT } from '@/components/game/types';
import { CardinalDirection } from '@/core/types';
import { getCachedImage } from '@/components/game/imageLoader';
import { COASTER_TRACK_SPRITES } from '@/components/coaster/coasterSprites';

export type TrackConnections = {
  north: boolean;
  east: boolean;
  south: boolean;
  west: boolean;
};

export type TrackType =
  | 'straight_ns'
  | 'straight_ew'
  | 'curve_ne'
  | 'curve_nw'
  | 'curve_se'
  | 'curve_sw'
  | 'junction_t_n'
  | 'junction_t_e'
  | 'junction_t_s'
  | 'junction_t_w'
  | 'junction_cross'
  | 'terminus_n'
  | 'terminus_e'
  | 'terminus_s'
  | 'terminus_w'
  | 'single';

const COASTER_COLORS = {
  RAIL: '#c2410c',
  RAIL_SHADOW: '#7c2d12',
  TIE: '#6b4f2c',
  STATION: '#f8fafc',
  LIFT: '#facc15',
  BRAKES: '#ef4444',
  BOOSTER: '#22c55e',
  LOOP: '#fb923c',
};

const TRACK_GAUGE_RATIO = 0.07;
const TIES_PER_TILE = 6;

const ISO_NS = { x: 0.894427, y: 0.447214 };
const ISO_EW = { x: -0.894427, y: 0.447214 };
const NEG_ISO_EW = { x: -ISO_EW.x, y: -ISO_EW.y };
const NEG_ISO_NS = { x: -ISO_NS.x, y: -ISO_NS.y };

const OPPOSITE_DIRECTION: Record<CardinalDirection, CardinalDirection> = {
  north: 'south',
  south: 'north',
  east: 'west',
  west: 'east',
};

const DIRECTION_STEP: Record<CardinalDirection, { dx: number; dy: number }> = {
  north: { dx: -1, dy: 0 },
  south: { dx: 1, dy: 0 },
  east: { dx: 0, dy: -1 },
  west: { dx: 0, dy: 1 },
};

export function isTrackTile(
  grid: CoasterTile[][],
  gridSize: number,
  x: number,
  y: number,
  rideId?: string
): boolean {
  if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) return false;
  const track = grid[y][x].track;
  if (!track) return false;
  if (rideId && track.rideId !== rideId) return false;
  return true;
}

export function getAdjacentTrack(
  grid: CoasterTile[][],
  gridSize: number,
  x: number,
  y: number,
  rideId?: string
): TrackConnections {
  return {
    north: isTrackTile(grid, gridSize, x - 1, y, rideId),
    east: isTrackTile(grid, gridSize, x, y - 1, rideId),
    south: isTrackTile(grid, gridSize, x + 1, y, rideId),
    west: isTrackTile(grid, gridSize, x, y + 1, rideId),
  };
}

export function getTrackType(connections: TrackConnections): TrackType {
  const { north, east, south, west } = connections;
  const count = [north, east, south, west].filter(Boolean).length;

  if (count === 4) return 'junction_cross';
  if (count === 3) {
    if (!north) return 'junction_t_n';
    if (!east) return 'junction_t_e';
    if (!south) return 'junction_t_s';
    if (!west) return 'junction_t_w';
  }
  if (north && south && !east && !west) return 'straight_ns';
  if (east && west && !north && !south) return 'straight_ew';
  if (north && east && !south && !west) return 'curve_ne';
  if (north && west && !south && !east) return 'curve_nw';
  if (south && east && !north && !west) return 'curve_se';
  if (south && west && !north && !east) return 'curve_sw';
  if (count === 1) {
    if (north) return 'terminus_s';
    if (east) return 'terminus_w';
    if (south) return 'terminus_n';
    if (west) return 'terminus_e';
  }
  return 'single';
}

function drawTrackSprite(
  ctx: CanvasRenderingContext2D,
  spriteKey: keyof typeof COASTER_TRACK_SPRITES,
  x: number,
  y: number,
  rotation: number
): boolean {
  const sprite = COASTER_TRACK_SPRITES[spriteKey];
  const img = getCachedImage(sprite.src);
  if (!img) return false;

  const baseScale = TILE_WIDTH / img.naturalWidth;
  const drawWidth = img.naturalWidth * baseScale * sprite.scale;
  const drawHeight = img.naturalHeight * baseScale * sprite.scale;
  const centerX = x + TILE_WIDTH / 2 + sprite.offsetX * TILE_WIDTH;
  const centerY = y + TILE_HEIGHT / 2 + sprite.offsetY * TILE_HEIGHT;

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(rotation);
  ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
  ctx.restore();
  return true;
}

function drawSingleStraightRails(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
  perp: { x: number; y: number },
  railWidth: number,
  halfGauge: number
) {
  ctx.strokeStyle = COASTER_COLORS.RAIL_SHADOW;
  ctx.lineWidth = railWidth + 0.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(from.x + perp.x * halfGauge + 0.3, from.y + perp.y * halfGauge + 0.3);
  ctx.lineTo(to.x + perp.x * halfGauge + 0.3, to.y + perp.y * halfGauge + 0.3);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(from.x - perp.x * halfGauge + 0.3, from.y - perp.y * halfGauge + 0.3);
  ctx.lineTo(to.x - perp.x * halfGauge + 0.3, to.y - perp.y * halfGauge + 0.3);
  ctx.stroke();

  ctx.strokeStyle = COASTER_COLORS.RAIL;
  ctx.lineWidth = railWidth;
  ctx.beginPath();
  ctx.moveTo(from.x + perp.x * halfGauge, from.y + perp.y * halfGauge);
  ctx.lineTo(to.x + perp.x * halfGauge, to.y + perp.y * halfGauge);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(from.x - perp.x * halfGauge, from.y - perp.y * halfGauge);
  ctx.lineTo(to.x - perp.x * halfGauge, to.y - perp.y * halfGauge);
  ctx.stroke();
}

function drawSingleCurvedRails(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
  control: { x: number; y: number },
  fromPerp: { x: number; y: number },
  toPerp: { x: number; y: number },
  railWidth: number,
  halfGauge: number
) {
  const midPerp = { x: (fromPerp.x + toPerp.x) / 2, y: (fromPerp.y + toPerp.y) / 2 };
  const midLen = Math.hypot(midPerp.x, midPerp.y);
  const ctrlPerp = { x: midPerp.x / midLen, y: midPerp.y / midLen };

  ctx.strokeStyle = COASTER_COLORS.RAIL_SHADOW;
  ctx.lineWidth = railWidth + 0.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(from.x + fromPerp.x * halfGauge + 0.3, from.y + fromPerp.y * halfGauge + 0.3);
  ctx.quadraticCurveTo(
    control.x + ctrlPerp.x * halfGauge + 0.3,
    control.y + ctrlPerp.y * halfGauge + 0.3,
    to.x + toPerp.x * halfGauge + 0.3,
    to.y + toPerp.y * halfGauge + 0.3
  );
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(from.x - fromPerp.x * halfGauge + 0.3, from.y - fromPerp.y * halfGauge + 0.3);
  ctx.quadraticCurveTo(
    control.x - ctrlPerp.x * halfGauge + 0.3,
    control.y - ctrlPerp.y * halfGauge + 0.3,
    to.x - toPerp.x * halfGauge + 0.3,
    to.y - toPerp.y * halfGauge + 0.3
  );
  ctx.stroke();

  ctx.strokeStyle = COASTER_COLORS.RAIL;
  ctx.lineWidth = railWidth;
  ctx.beginPath();
  ctx.moveTo(from.x + fromPerp.x * halfGauge, from.y + fromPerp.y * halfGauge);
  ctx.quadraticCurveTo(
    control.x + ctrlPerp.x * halfGauge,
    control.y + ctrlPerp.y * halfGauge,
    to.x + toPerp.x * halfGauge,
    to.y + toPerp.y * halfGauge
  );
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(from.x - fromPerp.x * halfGauge, from.y - fromPerp.y * halfGauge);
  ctx.quadraticCurveTo(
    control.x - ctrlPerp.x * halfGauge,
    control.y - ctrlPerp.y * halfGauge,
    to.x - toPerp.x * halfGauge,
    to.y - toPerp.y * halfGauge
  );
  ctx.stroke();
}

function drawTrackTies(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
  tieDir: { x: number; y: number },
  tiePerpDir: { x: number; y: number },
  count: number
) {
  const tieLength = TILE_WIDTH * 0.15;
  const tieWidth = TILE_WIDTH * 0.02;
  for (let i = 0; i < count; i += 1) {
    const t = (i + 0.5) / count;
    const x = from.x + (to.x - from.x) * t;
    const y = from.y + (to.y - from.y) * t;
    ctx.fillStyle = COASTER_COLORS.TIE;
    ctx.beginPath();
    ctx.moveTo(x + tieDir.x * tieLength + tiePerpDir.x * tieWidth, y + tieDir.y * tieLength + tiePerpDir.y * tieWidth);
    ctx.lineTo(x + tieDir.x * tieLength - tiePerpDir.x * tieWidth, y + tieDir.y * tieLength - tiePerpDir.y * tieWidth);
    ctx.lineTo(x - tieDir.x * tieLength - tiePerpDir.x * tieWidth, y - tieDir.y * tieLength - tiePerpDir.y * tieWidth);
    ctx.lineTo(x - tieDir.x * tieLength + tiePerpDir.x * tieWidth, y - tieDir.y * tieLength + tiePerpDir.y * tieWidth);
    ctx.closePath();
    ctx.fill();
  }
}

export function drawCoasterTrack(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  gridX: number,
  gridY: number,
  grid: CoasterTile[][],
  gridSize: number,
  zoom: number
) {
  const connections = getAdjacentTrack(grid, gridSize, gridX, gridY);
  const trackType = getTrackType(connections);

  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const railGauge = w * TRACK_GAUGE_RATIO;
  const railWidth = zoom >= 0.7 ? 1.1 : 0.8;
  const halfGauge = railGauge / 2;

  const northEdge = { x: x + w * 0.25, y: y + h * 0.25 };
  const eastEdge = { x: x + w * 0.75, y: y + h * 0.25 };
  const southEdge = { x: x + w * 0.75, y: y + h * 0.75 };
  const westEdge = { x: x + w * 0.25, y: y + h * 0.75 };
  const center = { x: x + w / 2, y: y + h / 2 };

  const special = grid[gridY][gridX].track?.special;
  const spriteKey =
    special === 'station'
      ? 'station'
      : special === 'lift'
      ? 'lift'
      : special === 'brakes'
      ? 'brakes'
      : special === 'booster'
      ? 'booster'
      : special === 'loop'
      ? 'loop'
      : special === 'corkscrew'
      ? 'corkscrew'
      : trackType.includes('curve')
      ? 'curve'
      : 'straight';

  let rotation = 0;
  if (trackType === 'straight_ew') rotation = Math.PI / 2;
  if (trackType === 'curve_se') rotation = Math.PI / 2;
  if (trackType === 'curve_sw') rotation = Math.PI;
  if (trackType === 'curve_nw') rotation = -Math.PI / 2;

  const useSprite =
    (trackType === 'straight_ns' ||
      trackType === 'straight_ew' ||
      trackType.startsWith('curve') ||
      special) &&
    drawTrackSprite(ctx, spriteKey, x, y, rotation);

  if (useSprite && !trackType.startsWith('junction')) {
    return;
  }

  switch (trackType) {
    case 'straight_ns':
      drawTrackTies(ctx, northEdge, southEdge, ISO_EW, ISO_NS, TIES_PER_TILE);
      drawSingleStraightRails(ctx, northEdge, southEdge, ISO_EW, railWidth, halfGauge);
      break;
    case 'straight_ew':
      drawTrackTies(ctx, eastEdge, westEdge, ISO_NS, ISO_EW, TIES_PER_TILE);
      drawSingleStraightRails(ctx, eastEdge, westEdge, ISO_NS, railWidth, halfGauge);
      break;
    case 'curve_ne':
      drawSingleCurvedRails(ctx, northEdge, eastEdge, center, ISO_EW, ISO_NS, railWidth, halfGauge);
      break;
    case 'curve_nw':
      drawSingleCurvedRails(ctx, northEdge, westEdge, center, NEG_ISO_EW, ISO_NS, railWidth, halfGauge);
      break;
    case 'curve_se':
      drawSingleCurvedRails(ctx, southEdge, eastEdge, center, ISO_EW, NEG_ISO_NS, railWidth, halfGauge);
      break;
    case 'curve_sw':
      drawSingleCurvedRails(ctx, southEdge, westEdge, center, NEG_ISO_EW, NEG_ISO_NS, railWidth, halfGauge);
      break;
    case 'junction_cross':
      drawTrackTies(ctx, northEdge, southEdge, ISO_EW, ISO_NS, TIES_PER_TILE);
      drawTrackTies(ctx, eastEdge, westEdge, ISO_NS, ISO_EW, TIES_PER_TILE);
      drawSingleStraightRails(ctx, northEdge, southEdge, ISO_EW, railWidth, halfGauge);
      drawSingleStraightRails(ctx, eastEdge, westEdge, ISO_NS, railWidth, halfGauge);
      break;
    case 'junction_t_n':
    case 'junction_t_e':
    case 'junction_t_s':
    case 'junction_t_w':
      drawSingleStraightRails(ctx, northEdge, southEdge, ISO_EW, railWidth, halfGauge);
      drawSingleStraightRails(ctx, eastEdge, westEdge, ISO_NS, railWidth, halfGauge);
      break;
    case 'terminus_n':
      drawSingleStraightRails(ctx, center, southEdge, ISO_EW, railWidth, halfGauge);
      break;
    case 'terminus_e':
      drawSingleStraightRails(ctx, center, westEdge, ISO_NS, railWidth, halfGauge);
      break;
    case 'terminus_s':
      drawSingleStraightRails(ctx, center, northEdge, ISO_EW, railWidth, halfGauge);
      break;
    case 'terminus_w':
      drawSingleStraightRails(ctx, center, eastEdge, ISO_NS, railWidth, halfGauge);
      break;
    case 'single':
    default:
      drawSingleStraightRails(ctx, center, northEdge, ISO_EW, railWidth, halfGauge);
      break;
  }

  if (special) {
    ctx.save();
    ctx.fillStyle =
      special === 'station'
        ? COASTER_COLORS.STATION
        : special === 'lift'
        ? COASTER_COLORS.LIFT
        : special === 'brakes'
        ? COASTER_COLORS.BRAKES
        : special === 'booster'
        ? COASTER_COLORS.BOOSTER
        : COASTER_COLORS.LOOP;
    ctx.beginPath();
    ctx.arc(center.x, center.y, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export function getTrackDirectionOptions(
  grid: CoasterTile[][],
  gridSize: number,
  x: number,
  y: number,
  rideId?: string
): CardinalDirection[] {
  const options: CardinalDirection[] = [];
  if (isTrackTile(grid, gridSize, x - 1, y, rideId)) options.push('north');
  if (isTrackTile(grid, gridSize, x, y - 1, rideId)) options.push('east');
  if (isTrackTile(grid, gridSize, x + 1, y, rideId)) options.push('south');
  if (isTrackTile(grid, gridSize, x, y + 1, rideId)) options.push('west');
  return options;
}

export function buildTrackLoop(
  grid: CoasterTile[][],
  gridSize: number,
  startX: number,
  startY: number,
  rideId?: string
): { x: number; y: number }[] | null {
  const startOptions = getTrackDirectionOptions(grid, gridSize, startX, startY, rideId);
  if (startOptions.length === 0) return null;

  const path: { x: number; y: number }[] = [{ x: startX, y: startY }];
  let currentX = startX;
  let currentY = startY;
  let direction = startOptions[0];

  const maxSteps = gridSize * gridSize;
  for (let i = 0; i < maxSteps; i += 1) {
    const step = DIRECTION_STEP[direction];
    const nextX = currentX + step.dx;
    const nextY = currentY + step.dy;
    if (!isTrackTile(grid, gridSize, nextX, nextY, rideId)) {
      return null;
    }

    if (nextX === startX && nextY === startY && path.length > 2) {
      return path;
    }

    path.push({ x: nextX, y: nextY });

    const options = getTrackDirectionOptions(grid, gridSize, nextX, nextY, rideId);
    const opposite = OPPOSITE_DIRECTION[direction];
    const nextOption = options.find((option) => option !== opposite);
    if (!nextOption) {
      return null;
    }

    currentX = nextX;
    currentY = nextY;
    direction = nextOption;
  }

  return null;
}
