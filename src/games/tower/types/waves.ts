/**
 * IsoTower Defense - Wave definitions (MVP)
 */

import type { EnemyType } from './enemies';

export type WaveSpawn = {
  type: EnemyType;
  count: number;
  // delay between spawns for this group, in ticks (TowerContext tick)
  intervalTicks: number;
};

export type WaveDefinition = {
  waveNumber: number;
  spawns: WaveSpawn[];
  // optional break time after wave ends (ticks)
  endDelayTicks: number;
};

export const WAVES: WaveDefinition[] = [
  { waveNumber: 1, spawns: [{ type: 'grunt', count: 8, intervalTicks: 14 }], endDelayTicks: 80 },
  { waveNumber: 2, spawns: [{ type: 'runner', count: 10, intervalTicks: 12 }], endDelayTicks: 90 },
  { waveNumber: 3, spawns: [{ type: 'grunt', count: 10, intervalTicks: 12 }, { type: 'runner', count: 6, intervalTicks: 10 }], endDelayTicks: 90 },
  { waveNumber: 4, spawns: [{ type: 'tank', count: 4, intervalTicks: 22 }, { type: 'grunt', count: 10, intervalTicks: 12 }], endDelayTicks: 100 },
  { waveNumber: 5, spawns: [{ type: 'armored', count: 8, intervalTicks: 16 }, { type: 'runner', count: 8, intervalTicks: 10 }], endDelayTicks: 110 },
  { waveNumber: 6, spawns: [{ type: 'flyer', count: 10, intervalTicks: 12 }], endDelayTicks: 120 },
  { waveNumber: 7, spawns: [{ type: 'tank', count: 8, intervalTicks: 20 }, { type: 'armored', count: 8, intervalTicks: 14 }], endDelayTicks: 130 },
  { waveNumber: 8, spawns: [{ type: 'grunt', count: 18, intervalTicks: 10 }, { type: 'runner', count: 14, intervalTicks: 9 }], endDelayTicks: 140 },
  { waveNumber: 9, spawns: [{ type: 'flyer', count: 14, intervalTicks: 10 }, { type: 'armored', count: 10, intervalTicks: 12 }], endDelayTicks: 150 },
  { waveNumber: 10, spawns: [{ type: 'boss', count: 1, intervalTicks: 1 }, { type: 'tank', count: 10, intervalTicks: 18 }], endDelayTicks: 180 },
];

