/**
 * IsoTower Defense - Tower definitions
 */

export type TowerType = 'cannon' | 'archer' | 'tesla' | 'ice' | 'mortar' | 'sniper';

export type TowerTargetingMode = 'first' | 'closest';

export type TowerLevelStats = {
  damage: number;
  range: number; // in tiles
  fireCooldownTicks: number; // ticks between shots
  projectileSpeed: number; // tiles per second (roughly, used by sim later)
  splashRadius?: number; // in tiles
  slowMultiplier?: number; // 0.0-1.0, applied to enemy speed (e.g. 0.6 = 40% slow)
};

export type TowerDefinition = {
  type: TowerType;
  name: string;
  description: string;
  baseCost: number;
  sellRefundRatio: number; // how much of total spent you get back when selling
  defaultTargeting: TowerTargetingMode;
  levels: [TowerLevelStats, TowerLevelStats, TowerLevelStats];
};

export const TOWER_DEFINITIONS: Record<TowerType, TowerDefinition> = {
  cannon: {
    type: 'cannon',
    name: 'Cannon Tower',
    description: 'Balanced damage and range.',
    baseCost: 100,
    sellRefundRatio: 0.7,
    defaultTargeting: 'first',
    levels: [
      { damage: 18, range: 3.5, fireCooldownTicks: 18, projectileSpeed: 7 },
      { damage: 28, range: 4.0, fireCooldownTicks: 16, projectileSpeed: 7.5 },
      { damage: 42, range: 4.5, fireCooldownTicks: 14, projectileSpeed: 8 },
    ],
  },
  archer: {
    type: 'archer',
    name: 'Archer Tower',
    description: 'Fast attacks, lower damage.',
    baseCost: 75,
    sellRefundRatio: 0.7,
    defaultTargeting: 'closest',
    levels: [
      { damage: 8, range: 3.0, fireCooldownTicks: 10, projectileSpeed: 10 },
      { damage: 12, range: 3.5, fireCooldownTicks: 9, projectileSpeed: 11 },
      { damage: 18, range: 4.0, fireCooldownTicks: 8, projectileSpeed: 12 },
    ],
  },
  tesla: {
    type: 'tesla',
    name: 'Tesla Tower',
    description: 'Arc damage with small splash.',
    baseCost: 160,
    sellRefundRatio: 0.7,
    defaultTargeting: 'closest',
    levels: [
      { damage: 14, range: 3.0, fireCooldownTicks: 14, projectileSpeed: 999, splashRadius: 0.6 },
      { damage: 22, range: 3.5, fireCooldownTicks: 13, projectileSpeed: 999, splashRadius: 0.8 },
      { damage: 34, range: 4.0, fireCooldownTicks: 12, projectileSpeed: 999, splashRadius: 1.0 },
    ],
  },
  ice: {
    type: 'ice',
    name: 'Ice Tower',
    description: 'Applies a slowing debuff.',
    baseCost: 140,
    sellRefundRatio: 0.7,
    defaultTargeting: 'first',
    levels: [
      { damage: 6, range: 3.0, fireCooldownTicks: 14, projectileSpeed: 8, slowMultiplier: 0.72 },
      { damage: 10, range: 3.5, fireCooldownTicks: 13, projectileSpeed: 8.5, slowMultiplier: 0.65 },
      { damage: 16, range: 4.0, fireCooldownTicks: 12, projectileSpeed: 9, slowMultiplier: 0.55 },
    ],
  },
  mortar: {
    type: 'mortar',
    name: 'Mortar Tower',
    description: 'Slow, powerful splash damage.',
    baseCost: 220,
    sellRefundRatio: 0.7,
    defaultTargeting: 'first',
    levels: [
      { damage: 40, range: 4.5, fireCooldownTicks: 28, projectileSpeed: 6, splashRadius: 1.1 },
      { damage: 60, range: 5.0, fireCooldownTicks: 26, projectileSpeed: 6.5, splashRadius: 1.3 },
      { damage: 90, range: 5.5, fireCooldownTicks: 24, projectileSpeed: 7, splashRadius: 1.5 },
    ],
  },
  sniper: {
    type: 'sniper',
    name: 'Sniper Tower',
    description: 'Long range, high damage, slow fire rate.',
    baseCost: 260,
    sellRefundRatio: 0.7,
    defaultTargeting: 'first',
    levels: [
      { damage: 65, range: 6.5, fireCooldownTicks: 34, projectileSpeed: 16 },
      { damage: 95, range: 7.2, fireCooldownTicks: 32, projectileSpeed: 17 },
      { damage: 140, range: 8.0, fireCooldownTicks: 30, projectileSpeed: 18 },
    ],
  },
};

export function clampTowerLevel(level: number): 1 | 2 | 3 {
  if (level <= 1) return 1;
  if (level >= 3) return 3;
  return 2;
}

export function getTowerStats(type: TowerType, level: number): TowerLevelStats {
  const def = TOWER_DEFINITIONS[type];
  const clamped = clampTowerLevel(level);
  return def.levels[clamped - 1];
}

