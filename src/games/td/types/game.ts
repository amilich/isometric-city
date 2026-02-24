/**
 * Tower Defense Game Types
 */

// =============================================================================
// TOWER TYPES
// =============================================================================

export type TowerType = 'basic' | 'cannon' | 'ice' | 'laser';

export interface Tower {
  id: string;
  type: TowerType;
  x: number;
  y: number;
  level: number;
  damage: number;
  range: number;
  fireRate: number; // ms between shots
  lastShotAt: number;
  cost: number;
}

export const TOWER_STATS: Record<TowerType, { damage: number; range: number; fireRate: number; cost: number; name: string }> = {
  basic: { damage: 10, range: 2, fireRate: 800, cost: 50, name: 'Basic Tower' },
  cannon: { damage: 25, range: 2, fireRate: 1200, cost: 100, name: 'Cannon' },
  ice: { damage: 5, range: 3, fireRate: 600, cost: 80, name: 'Ice Tower' },
  laser: { damage: 15, range: 4, fireRate: 400, cost: 150, name: 'Laser Tower' },
};

// =============================================================================
// ENEMY TYPES
// =============================================================================

export type EnemyType = 'basic' | 'fast' | 'tank';

export interface Enemy {
  id: string;
  type: EnemyType;
  x: number;
  y: number;
  pathIndex: number;
  health: number;
  maxHealth: number;
  speed: number; // tiles per second
  reward: number;
  slowUntil?: number; // timestamp when slow effect ends
}

export const ENEMY_STATS: Record<EnemyType, { health: number; speed: number; reward: number }> = {
  basic: { health: 50, speed: 0.8, reward: 10 },
  fast: { health: 25, speed: 1.5, reward: 15 },
  tank: { health: 150, speed: 0.4, reward: 30 },
};

// =============================================================================
// PROJECTILE TYPES
// =============================================================================

export interface Projectile {
  id: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  progress: number; // 0 to 1
  damage: number;
  targetId: string;
  isIce?: boolean;
}

// =============================================================================
// TILE TYPES
// =============================================================================

export type TileType = 'grass' | 'path' | 'spawn' | 'goal';

export interface Tile {
  x: number;
  y: number;
  type: TileType;
  tower: Tower | null;
  pathIndex: number; // -1 if not on path, else order in path
}

// =============================================================================
// WAVE TYPES
// =============================================================================

export interface WaveEnemy {
  type: EnemyType;
  count: number;
  delay: number; // ms between spawns
}

export interface Wave {
  enemies: WaveEnemy[];
  reward: number; // bonus for completing wave
}

// =============================================================================
// GAME STATE
// =============================================================================

export type GamePhase = 'playing' | 'won' | 'lost' | 'paused';

export interface GameState {
  id: string;
  gridSize: number;
  path: { x: number; y: number }[];
  grid: Tile[][];

  // Resources
  money: number;
  lives: number;
  startLives: number;

  // Wave
  currentWave: number;
  waveEnemiesRemaining: number;
  waveSpawnCooldown: number;
  waveEnemyQueue: { type: EnemyType; spawnAt: number }[];

  // Entities
  enemies: Enemy[];
  projectiles: Projectile[];

  // Time
  tick: number;
  lastTickAt: number;
  phase: GamePhase;
  speed: 0 | 1 | 2 | 3;

  // UI
  selectedTool: TowerType | 'sell' | 'upgrade' | null;
  selectedTile: { x: number; y: number } | null;
  hoveredTile: { x: number; y: number } | null;

  gameVersion: number;
}
