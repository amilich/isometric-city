/**
 * IsoTower Defense - Sprite render configuration
 *
 * For MVP we keep it intentionally small:
 * - One sheet for towers
 * - One sheet for enemies
 *
 * Both follow the isometric-asset-sheets skill format:
 * - 2048x2048
 * - 6 rows x 5 columns
 * - red background (#FF0000) to be filtered to transparent
 */

export type TowerSpriteName =
  | 'tower_cannon'
  | 'tower_archer'
  | 'tower_tesla'
  | 'tower_ice'
  | 'tower_mortar';

export type EnemySpriteName =
  | 'enemy_runner'
  | 'enemy_grunt'
  | 'enemy_tank'
  | 'enemy_armored'
  | 'enemy_flyer'
  | 'enemy_boss';

export type SpriteSheetConfig = {
  id: string;
  src: string;
  cols: number;
  rows: number;
  sprites: { name: string; row: number; col: number; offsetX?: number; offsetY?: number; scale?: number }[];
};

export const TOWER_SPRITE_SHEET: SpriteSheetConfig = {
  id: 'towers',
  // Populated in Phase 5 with generated assets
  src: '/assets/tower/towers.webp',
  cols: 5,
  rows: 6,
  sprites: [
    { name: 'tower_cannon', row: 0, col: 0, offsetY: -18, scale: 0.9 },
    { name: 'tower_archer', row: 1, col: 0, offsetY: -18, scale: 0.9 },
    { name: 'tower_tesla', row: 2, col: 0, offsetY: -18, scale: 0.9 },
    { name: 'tower_ice', row: 3, col: 0, offsetY: -18, scale: 0.9 },
    { name: 'tower_mortar', row: 4, col: 0, offsetY: -18, scale: 0.9 },
  ],
};

export const ENEMY_SPRITE_SHEET: SpriteSheetConfig = {
  id: 'enemies',
  // Populated in Phase 5 with generated assets
  src: '/assets/tower/enemies.webp',
  cols: 5,
  rows: 6,
  sprites: [
    { name: 'enemy_runner', row: 0, col: 0, offsetY: -12, scale: 0.75 },
    { name: 'enemy_grunt', row: 1, col: 0, offsetY: -12, scale: 0.75 },
    { name: 'enemy_tank', row: 2, col: 0, offsetY: -12, scale: 0.75 },
    { name: 'enemy_armored', row: 3, col: 0, offsetY: -12, scale: 0.75 },
    { name: 'enemy_flyer', row: 4, col: 0, offsetY: -16, scale: 0.75 },
    { name: 'enemy_boss', row: 5, col: 0, offsetY: -14, scale: 0.8 },
  ],
};

export const TOWER_SPRITE_PACK = {
  id: 'tower-pack-v1',
  name: 'IsoTower Pack (v1)',
  sheets: [TOWER_SPRITE_SHEET, ENEMY_SPRITE_SHEET],
};

export function getSpriteInfo(name: string) {
  for (const sheet of TOWER_SPRITE_PACK.sheets) {
    const sprite = sheet.sprites.find((s) => s.name === name);
    if (sprite) return { sheet, sprite };
  }
  return null;
}

export function getSpriteRect(
  sheet: SpriteSheetConfig,
  sprite: { row: number; col: number },
  sheetWidth: number,
  sheetHeight: number
) {
  const cellW = sheetWidth / sheet.cols;
  const cellH = sheetHeight / sheet.rows;
  return {
    sx: Math.floor(sprite.col * cellW),
    sy: Math.floor(sprite.row * cellH),
    sw: Math.floor(cellW),
    sh: Math.floor(cellH),
  };
}

