/**
 * Tower Defense - Game simulation loop
 */

import type { GameState, Enemy, Projectile, Tower, TowerType } from '../types';
import { TOWER_STATS, ENEMY_STATS } from '../types/game';
import { getWave } from './initialState';

const TICK_MS = 50; // 20 ticks per second

function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

function findEnemyInRange(
  state: GameState,
  towerX: number,
  towerY: number,
  range: number
): Enemy | null {
  let closest: Enemy | null = null;
  let closestDist = range + 1;

  for (const enemy of state.enemies) {
    const d = distance(towerX, towerY, enemy.x, enemy.y);
    if (d <= range && d < closestDist) {
      closest = enemy;
      closestDist = d;
    }
  }
  return closest;
}

function createTower(type: TowerType, x: number, y: number): Tower {
  const stats = TOWER_STATS[type];
  return {
    id: `tower-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type,
    x,
    y,
    level: 1,
    damage: stats.damage,
    range: stats.range,
    fireRate: stats.fireRate,
    lastShotAt: 0,
    cost: stats.cost,
  };
}

export function simulateTick(state: GameState, now: number): GameState {
  if (state.phase === 'won' || state.phase === 'lost') return state;

  const dt = Math.min(now - state.lastTickAt, 100); // Cap delta at 100ms
  const speedMultiplier = state.speed === 0 ? 0 : state.speed;
  const effectiveDt = dt * speedMultiplier;

  let newState: GameState = { ...state, lastTickAt: now };

  if (state.speed === 0) return newState;

  // 1. Process wave spawning - only start next wave when current wave is complete (all enemies dead)
  const waveComplete =
    newState.waveEnemiesRemaining === 0 &&
    newState.waveEnemyQueue.length === 0 &&
    newState.enemies.length === 0;

  if (waveComplete && newState.currentWave > 0) {
    const completedWave = getWave(newState.currentWave - 1);
    newState = { ...newState, money: newState.money + completedWave.reward };
    if (newState.currentWave >= 10) {
      newState = { ...newState, phase: 'won' };
      return newState; // Don't spawn next wave
    }
  }

  if (waveComplete) {
    // Start next wave
    const wave = getWave(newState.currentWave);
    const queue: { type: Enemy['type']; spawnAt: number }[] = [];
    let spawnTime = now;
    for (const group of wave.enemies) {
      for (let i = 0; i < group.count; i++) {
        queue.push({ type: group.type, spawnAt: spawnTime });
        spawnTime += group.delay;
      }
    }
    newState = {
      ...newState,
      currentWave: newState.currentWave + 1,
      waveEnemiesRemaining: queue.length,
      waveEnemyQueue: queue,
    };
  }

  // Spawn enemies from queue
  const toSpawn = newState.waveEnemyQueue.filter((e) => e.spawnAt <= now);
  const toKeep = newState.waveEnemyQueue.filter((e) => e.spawnAt > now);

  for (const { type } of toSpawn) {
    const stats = ENEMY_STATS[type];
    const spawn = newState.path[0];
    newState = {
      ...newState,
      enemies: [
        ...newState.enemies,
        {
          id: `enemy-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          type,
          x: spawn.x,
          y: spawn.y,
          pathIndex: 0,
          health: stats.health,
          maxHealth: stats.health,
          speed: stats.speed,
          reward: stats.reward,
        },
      ],
      waveEnemiesRemaining: newState.waveEnemiesRemaining - 1,
    };
  }
  newState = { ...newState, waveEnemyQueue: toKeep };

  // 2. Tower firing
  const newProjectiles: Projectile[] = [...newState.projectiles];
  const towersToUpdate: { x: number; y: number }[] = [];

  for (let row of newState.grid) {
    for (let tile of row) {
      if (!tile.tower) continue;
      const tower = tile.tower;
      const stats = TOWER_STATS[tower.type];
      if (now - tower.lastShotAt < stats.fireRate) continue;

      const target = findEnemyInRange(newState, tower.x, tower.y, tower.range);
      if (!target) continue;

      newProjectiles.push({
        id: `proj-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        fromX: tower.x,
        fromY: tower.y,
        toX: target.x,
        toY: target.y,
        progress: 0,
        damage: tower.damage,
        targetId: target.id,
        isIce: tower.type === 'ice',
      });
      towersToUpdate.push({ x: tower.x, y: tower.y });
    }
  }

  // Update tower lastShotAt for towers that fired
  if (towersToUpdate.length > 0) {
    const gridCopy = newState.grid.map((r) => r.map((t) => ({ ...t })));
    for (const { x, y } of towersToUpdate) {
      const tile = gridCopy[y][x];
      if (tile.tower) {
        tile.tower = { ...tile.tower, lastShotAt: now };
      }
    }
    newState = { ...newState, grid: gridCopy };
  }

  newState = { ...newState, projectiles: newProjectiles };

  // 3. Update projectiles
  const progressDelta = (effectiveDt / 1000) * 5; // ~0.2s to reach target
  const allUpdatedProjectiles = newState.projectiles.map((p) => ({
    ...p,
    progress: p.progress + progressDelta,
  }));

  const hitProjectiles = allUpdatedProjectiles.filter((p) => p.progress >= 1);
  const updatedProjectiles = allUpdatedProjectiles.filter((p) => p.progress < 1);
  let enemies = [...newState.enemies];
  let money = newState.money;

  for (const p of hitProjectiles) {
    const enemy = enemies.find((e) => e.id === p.targetId);
    if (enemy) {
      const newHealth = enemy.health - p.damage;
      if (newHealth <= 0) {
        enemies = enemies.filter((e) => e.id !== p.targetId);
        money += enemy.reward;
      } else {
        enemies = enemies.map((e) =>
          e.id === p.targetId
            ? {
                ...e,
                health: newHealth,
                slowUntil: p.isIce ? now + 1000 : e.slowUntil,
              }
            : e
        );
      }
    }
  }

  newState = {
    ...newState,
    projectiles: updatedProjectiles,
    enemies,
    money,
  };

  // 4. Move enemies along path
  const path = newState.path;
  const movedEnemies: Enemy[] = [];
  let livesLost = 0;

  for (const enemy of newState.enemies) {
    const next = path[enemy.pathIndex + 1];
    if (!next) {
      // Reached goal - lose a life
      livesLost++;
      continue;
    }

    let speed = enemy.speed;
    if (enemy.slowUntil && now < enemy.slowUntil) {
      speed *= 0.5;
    }

    const dx = next.x - enemy.x;
    const dy = next.y - enemy.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const moveDist = (effectiveDt / 1000) * speed;

    if (dist <= moveDist) {
      movedEnemies.push({
        ...enemy,
        x: next.x,
        y: next.y,
        pathIndex: enemy.pathIndex + 1,
      });
    } else {
      const ratio = moveDist / dist;
      movedEnemies.push({
        ...enemy,
        x: enemy.x + dx * ratio,
        y: enemy.y + dy * ratio,
      });
    }
  }

  newState = {
    ...newState,
    enemies: movedEnemies,
    lives: newState.lives - livesLost,
  };

  // 5. Check win/lose
  if (newState.lives <= 0) {
    newState = { ...newState, phase: 'lost' };
  }

  return newState;
}

export function placeTower(state: GameState, x: number, y: number, type: TowerType): GameState {
  const tile = state.grid[y]?.[x];
  if (!tile || tile.type !== 'grass' || tile.tower) return state;
  if (state.money < TOWER_STATS[type].cost) return state;

  const tower = createTower(type, x, y);
  const gridCopy = state.grid.map((r) => r.map((t) => ({ ...t })));
  gridCopy[y][x] = { ...gridCopy[y][x], tower };

  return {
    ...state,
    grid: gridCopy,
    money: state.money - tower.cost,
  };
}

export function sellTower(state: GameState, x: number, y: number): GameState {
  const tile = state.grid[y]?.[x];
  if (!tile?.tower) return state;

  const refund = Math.floor(tile.tower.cost * 0.5);
  const gridCopy = state.grid.map((r) => r.map((t) => ({ ...t })));
  gridCopy[y][x] = { ...gridCopy[y][x], tower: null };

  return {
    ...state,
    grid: gridCopy,
    money: state.money + refund,
  };
}
