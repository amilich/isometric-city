/**
 * IsoTower Defense - Enemy definitions
 */

export type EnemyType = 'runner' | 'grunt' | 'tank' | 'armored' | 'flyer' | 'boss';

export type EnemyDefinition = {
  type: EnemyType;
  name: string;
  baseHp: number;
  speedTilesPerSecond: number;
  reward: number;
  armorMultiplier?: number; // incoming damage multiplier (e.g. 0.75 = 25% reduction)
  isFlying?: boolean;
};

export const ENEMY_DEFINITIONS: Record<EnemyType, EnemyDefinition> = {
  runner: { type: 'runner', name: 'Runner', baseHp: 40, speedTilesPerSecond: 1.8, reward: 10 },
  grunt: { type: 'grunt', name: 'Grunt', baseHp: 80, speedTilesPerSecond: 1.2, reward: 15 },
  tank: { type: 'tank', name: 'Tank', baseHp: 200, speedTilesPerSecond: 0.8, reward: 30 },
  armored: { type: 'armored', name: 'Armored', baseHp: 140, speedTilesPerSecond: 1.0, reward: 25, armorMultiplier: 0.75 },
  flyer: { type: 'flyer', name: 'Flyer', baseHp: 90, speedTilesPerSecond: 1.5, reward: 20, isFlying: true },
  boss: { type: 'boss', name: 'Boss', baseHp: 900, speedTilesPerSecond: 0.7, reward: 120, armorMultiplier: 0.9 },
};

