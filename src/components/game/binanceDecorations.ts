import { BuildingType, Tile } from '@/types/game';
import { TILE_HEIGHT, TILE_WIDTH } from './types';
import { getCachedImage } from './imageLoader';

export const BINANCE_LOGO_ASSET_PATH = '/assets/binance-logo.png';

const BINANCE_GOLD = '#F3BA2F';
const BINANCE_GOLD_LIGHT = '#FFD76A';
const BINANCE_INK = '#111318';

const COMMERCIAL_BUILDINGS = new Set<BuildingType>([
  'shop_small',
  'shop_medium',
  'office_low',
  'office_high',
  'mall',
  'office_building_small',
]);

const PARK_BUILDINGS = new Set<BuildingType>([
  'park',
  'park_large',
  'community_garden',
  'pond_park',
  'park_gate',
]);

export type BinanceDecorationKind = 'billboard' | 'bnb_coin' | 'civic_flag' | 'stadium_sponsor';

export function getBinanceDecorationKind(tile: Tile): BinanceDecorationKind | null {
  if (tile.building.abandoned || tile.building.constructionProgress < 100) return null;

  const type = tile.building.type;
  const seed = Math.abs(tile.x * 73 + tile.y * 41);

  if (COMMERCIAL_BUILDINGS.has(type) && seed % 5 === 0) return 'billboard';
  if (PARK_BUILDINGS.has(type) && seed % 3 === 0) return 'bnb_coin';
  if (type === 'city_hall') return 'civic_flag';
  if (type === 'stadium' || type === 'baseball_stadium') return 'stadium_sponsor';
  return null;
}

function drawDiamond(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
): void {
  ctx.beginPath();
  ctx.moveTo(centerX, centerY - radius);
  ctx.lineTo(centerX + radius, centerY);
  ctx.lineTo(centerX, centerY + radius);
  ctx.lineTo(centerX - radius, centerY);
  ctx.closePath();
  ctx.fill();
}

/** Draw the recognizable five-diamond Binance mark using canvas primitives. */
export function drawBinanceMark(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  size: number,
  color = BINANCE_GOLD,
): void {
  const unit = size * 0.2;
  const gap = size * 0.31;
  ctx.save();
  ctx.fillStyle = color;
  drawDiamond(ctx, centerX, centerY, unit);
  drawDiamond(ctx, centerX, centerY - gap, unit);
  drawDiamond(ctx, centerX + gap, centerY, unit);
  drawDiamond(ctx, centerX, centerY + gap, unit);
  drawDiamond(ctx, centerX - gap, centerY, unit);
  ctx.restore();
}

function drawBinanceLogo(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  size: number,
): void {
  const logo = getCachedImage(BINANCE_LOGO_ASSET_PATH);
  if (logo) {
    ctx.drawImage(logo, centerX - size / 2, centerY - size / 2, size, size);
    return;
  }
  drawBinanceMark(ctx, centerX, centerY, size * 0.8);
}

function drawCommercialBillboard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  seed: number,
): void {
  const signWidth = seed % 2 === 0 ? 48 : 42;
  const signHeight = 17;
  const centerX = x + TILE_WIDTH * 0.5;
  const bottomY = y + TILE_HEIGHT * 0.26;
  const signY = bottomY - 34;

  ctx.save();
  ctx.strokeStyle = '#6B5B2A';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(centerX - signWidth * 0.28, bottomY);
  ctx.lineTo(centerX - signWidth * 0.28, signY + signHeight);
  ctx.moveTo(centerX + signWidth * 0.28, bottomY);
  ctx.lineTo(centerX + signWidth * 0.28, signY + signHeight);
  ctx.stroke();

  ctx.shadowColor = 'rgba(243, 186, 47, 0.55)';
  ctx.shadowBlur = 7;
  ctx.fillStyle = BINANCE_INK;
  ctx.fillRect(centerX - signWidth / 2, signY, signWidth, signHeight);
  ctx.strokeStyle = BINANCE_GOLD;
  ctx.lineWidth = 1;
  ctx.strokeRect(centerX - signWidth / 2, signY, signWidth, signHeight);
  ctx.shadowBlur = 0;

  drawBinanceLogo(ctx, centerX - signWidth * 0.31, signY + signHeight / 2, 12);
  ctx.fillStyle = BINANCE_GOLD_LIGHT;
  ctx.font = 'bold 6px ui-sans-serif, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('BINANCE', centerX - signWidth * 0.14, signY + signHeight / 2 + 0.5);
  ctx.restore();
}

function drawBnbParkCoin(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const centerX = x + TILE_WIDTH * 0.5;
  const centerY = y + TILE_HEIGHT * 0.5;

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.scale(1, 0.58);
  ctx.shadowColor = 'rgba(17, 19, 24, 0.45)';
  ctx.shadowBlur = 4;
  drawBinanceLogo(ctx, 0, 2.5, 28);
  ctx.shadowBlur = 0;
  drawBinanceLogo(ctx, 0, 0, 28);
  ctx.restore();
}

function drawCivicFlag(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const poleX = x + TILE_WIDTH * 0.72;
  const poleBottom = y + TILE_HEIGHT * 0.32;
  const poleTop = poleBottom - 58;

  ctx.save();
  ctx.strokeStyle = '#D8DEE9';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(poleX, poleBottom);
  ctx.lineTo(poleX, poleTop);
  ctx.stroke();
  ctx.fillStyle = BINANCE_INK;
  ctx.beginPath();
  ctx.moveTo(poleX + 1, poleTop + 2);
  ctx.lineTo(poleX + 28, poleTop + 7);
  ctx.lineTo(poleX + 1, poleTop + 18);
  ctx.closePath();
  ctx.fill();
  drawBinanceLogo(ctx, poleX + 11, poleTop + 10, 14);
  ctx.restore();
}

function drawStadiumSponsor(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const centerX = x + TILE_WIDTH * 0.5;
  const centerY = y + TILE_HEIGHT * 0.56;
  const width = 66;
  const height = 15;

  ctx.save();
  ctx.fillStyle = BINANCE_INK;
  ctx.fillRect(centerX - width / 2, centerY - height / 2, width, height);
  ctx.strokeStyle = BINANCE_GOLD;
  ctx.lineWidth = 1.2;
  ctx.strokeRect(centerX - width / 2, centerY - height / 2, width, height);
  drawBinanceLogo(ctx, centerX - 24, centerY, 12);
  ctx.fillStyle = BINANCE_GOLD_LIGHT;
  ctx.font = 'bold 7px ui-sans-serif, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('BNB ARENA', centerX - 14, centerY + 0.5);
  ctx.restore();
}

/**
 * Add deterministic Binance-inspired details without affecting simulation or saves.
 * Decorations only appear on completed, active buildings at useful zoom levels.
 */
export function drawBinanceDecoration(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  tile: Tile,
  zoom: number,
): void {
  if (zoom < 0.55) return;

  const kind = getBinanceDecorationKind(tile);
  if (!kind) return;
  const seed = Math.abs(tile.x * 73 + tile.y * 41);

  switch (kind) {
    case 'billboard':
      drawCommercialBillboard(ctx, x, y, seed);
      break;
    case 'bnb_coin':
      drawBnbParkCoin(ctx, x, y);
      break;
    case 'civic_flag':
      drawCivicFlag(ctx, x, y);
      break;
    case 'stadium_sponsor':
      drawStadiumSponsor(ctx, x, y);
      break;
  }
}
