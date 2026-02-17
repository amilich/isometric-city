/**
 * IsoTower Defense - core game state types
 *
 * MVP notes:
 * - We intentionally keep this isolated from IsoCity/IsoCoaster types.
 * - The architecture mirrors the modular IsoCoaster layout.
 */

import { msg } from 'gt-next';
import type { EnemyType } from './enemies';
import type { TowerTargetingMode, TowerType } from './towers';

// =============================================================================
// TOOLS
// =============================================================================

export type Tool =
  | 'select'
  | 'bulldoze'
  | 'tower_cannon'
  | 'tower_archer'
  | 'tower_tesla'
  | 'tower_ice'
  | 'tower_mortar'
  | 'tower_sniper';

export type ToolCategory = 'tools' | 'towers';

export type ToolInfo = {
  name: string;
  cost: number;
  description: string;
  category: ToolCategory;
};

export const TOOL_INFO: Record<Tool, ToolInfo> = {
  select: { name: msg('Select'), cost: 0, description: msg('Select and inspect tiles'), category: 'tools' },
  bulldoze: { name: msg('Sell'), cost: 0, description: msg('Sell a placed tower for a refund'), category: 'tools' },
  tower_cannon: { name: msg('Cannon Tower'), cost: 100, description: msg('Balanced damage and range'), category: 'towers' },
  tower_archer: { name: msg('Archer Tower'), cost: 75, description: msg('Fast attacks, lower damage'), category: 'towers' },
  tower_tesla: { name: msg('Tesla Tower'), cost: 160, description: msg('Arc damage with small splash'), category: 'towers' },
  tower_ice: { name: msg('Ice Tower'), cost: 140, description: msg('Applies a slowing debuff'), category: 'towers' },
  tower_mortar: { name: msg('Mortar Tower'), cost: 220, description: msg('Slow, powerful splash damage'), category: 'towers' },
  tower_sniper: { name: msg('Sniper Tower'), cost: 260, description: msg('Long range, high damage, slow fire rate'), category: 'towers' },
};

export const TOWER_TOOL_TO_TYPE: Record<Exclude<Tool, 'select' | 'bulldoze'>, TowerType> = {
  tower_cannon: 'cannon',
  tower_archer: 'archer',
  tower_tesla: 'tesla',
  tower_ice: 'ice',
  tower_mortar: 'mortar',
  tower_sniper: 'sniper',
};

// =============================================================================
// GRID / MAP TYPES
// =============================================================================

export type Terrain = 'grass' | 'water';
export type TileKind = 'empty' | 'path' | 'spawn' | 'base';

export type Tile = {
  x: number;
  y: number;
  terrain: Terrain;
  kind: TileKind;
  tower: TowerInstance | null;
};

export type TowerInstance = {
  id: string;
  type: TowerType;
  level: 1 | 2 | 3;
  targeting: TowerTargetingMode;
  totalSpent: number; // used for sell value
  cooldownRemainingTicks: number;
};

// =============================================================================
// ENEMY / PROJECTILE TYPES (render + simulation)
// =============================================================================

export type EnemyId = string;

export type EnemyInstance = {
  id: EnemyId;
  type: EnemyType;
  hp: number;
  maxHp: number;
  speedTilesPerSecond: number;
  armorMultiplier: number;
  isFlying: boolean;
  reward: number;
  // Path-following state
  pathIndex: number;
  // fractional position between path points
  progress: number;
  // debuffs
  slowMultiplier: number;
  slowRemainingTicks: number;
};

export type ProjectileId = string;

export type ProjectileInstance = {
  id: ProjectileId;
  from: { x: number; y: number };
  toEnemyId: EnemyId;
  isInstant: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  splashRadius: number;
  slowMultiplier: number | null;
  slowDurationTicks: number;
};

// =============================================================================
// GAME STATE
// =============================================================================

export type Difficulty = 'normal' | 'hard';

export type TowerSettings = {
  name: string;
  difficulty: Difficulty;
  showGrid: boolean;
};

export type TowerStats = {
  wave: number;
  kills: number;
  leaks: number;
  moneyEarned: number;
  moneySpent: number;
};

export type WaveState = 'idle' | 'spawning' | 'in_progress' | 'complete' | 'game_over';

export type GameState = {
  id: string;
  seed: number;
  gridSize: number;
  grid: Tile[][];
  tick: number;
  speed: 0 | 1 | 2 | 3;
  selectedTool: Tool;
  activePanel: 'none' | 'settings' | 'stats';

  // resources
  money: number;
  lives: number;

  // pathing (tile coordinates)
  path: { x: number; y: number }[];
  spawn: { x: number; y: number };
  base: { x: number; y: number };

  // simulation entities
  enemies: EnemyInstance[];
  projectiles: ProjectileInstance[];

  waveState: WaveState;
  waveSpawnQueue: { enemyType: EnemyType; ticksUntilSpawn: number }[];

  settings: TowerSettings;
  stats: TowerStats;
};

export function createEmptyTile(x: number, y: number): Tile {
  return { x, y, terrain: 'grass', kind: 'empty', tower: null };
}

