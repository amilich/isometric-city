import type { GameState, EnemyInstance, ProjectileInstance, Tile, TowerInstance } from '@/games/tower/types';
import { ENEMY_DEFINITIONS } from '@/games/tower/types/enemies';
import { getTowerStats, TOWER_DEFINITIONS } from '@/games/tower/types/towers';
import { distSq, lerp, uuid } from '@/games/tower/lib/math';
import { FINAL_WAVE_NUMBER, WAVES } from '@/games/tower/types/waves';

const BASE_DT_SECONDS = 0.05; // 50ms "game time" per tick (speed increases by running more ticks)

function getWaveDefinition(waveNumber: number) {
  const def = WAVES.find((w) => w.waveNumber === waveNumber);
  if (def) return def;
  // If we run out of authored waves, repeat the last wave and scale counts.
  const last = WAVES[WAVES.length - 1];
  if (!last) return null;
  const scale = Math.max(1, Math.floor(waveNumber / last.waveNumber));
  return {
    ...last,
    waveNumber,
    spawns: last.spawns.map((s) => ({ ...s, count: s.count + scale * 3 })),
  };
}

function getEnemyPosition(state: GameState, enemy: EnemyInstance) {
  const from = state.path[Math.min(enemy.pathIndex, state.path.length - 1)] ?? state.base;
  const to = state.path[Math.min(enemy.pathIndex + 1, state.path.length - 1)] ?? state.base;
  return {
    x: lerp(from.x + 0.5, to.x + 0.5, enemy.progress),
    y: lerp(from.y + 0.5, to.y + 0.5, enemy.progress),
  };
}

function isEnemyAtBase(state: GameState, enemy: EnemyInstance) {
  return enemy.pathIndex >= state.path.length - 1;
}

function difficultyHpMultiplier(difficulty: GameState['settings']['difficulty']) {
  return difficulty === 'hard' ? 1.35 : 1.0;
}

function buildSpawnQueue(state: GameState, waveNumber: number) {
  const def = getWaveDefinition(waveNumber);
  if (!def) return [];
  const queue: GameState['waveSpawnQueue'] = [];
  for (const group of def.spawns) {
    for (let i = 0; i < group.count; i++) {
      queue.push({
        enemyType: group.type,
        ticksUntilSpawn: queue.length === 0 ? 1 : group.intervalTicks,
      });
    }
  }
  return queue;
}

function spawnEnemy(state: GameState, enemyType: EnemyInstance['type']): EnemyInstance {
  const def = ENEMY_DEFINITIONS[enemyType];
  const hpMult = difficultyHpMultiplier(state.settings.difficulty);
  const maxHp = Math.floor(def.baseHp * hpMult);
  return {
    id: uuid(`enemy-${enemyType}`),
    type: enemyType,
    hp: maxHp,
    maxHp,
    speedTilesPerSecond: def.speedTilesPerSecond,
    armorMultiplier: def.armorMultiplier ?? 1,
    isFlying: Boolean(def.isFlying),
    reward: def.reward,
    pathIndex: 0,
    progress: 0,
    slowMultiplier: 1,
    slowRemainingTicks: 0,
  };
}

function applyDamage(enemy: EnemyInstance, damage: number) {
  const effective = Math.max(0, Math.floor(damage * enemy.armorMultiplier));
  enemy.hp -= effective;
}

function applySlow(enemy: EnemyInstance, slowMultiplier: number, durationTicks: number) {
  enemy.slowMultiplier = Math.min(enemy.slowMultiplier, slowMultiplier);
  enemy.slowRemainingTicks = Math.max(enemy.slowRemainingTicks, durationTicks);
}

function tryFireTower(
  state: GameState,
  tower: TowerInstance,
  towerPos: { x: number; y: number }
): { tower: TowerInstance; projectiles: ProjectileInstance[] } {
  if (tower.cooldownRemainingTicks > 0) {
    return { tower: { ...tower, cooldownRemainingTicks: tower.cooldownRemainingTicks - 1 }, projectiles: [] };
  }

  const stats = getTowerStats(tower.type, tower.level);
  const rangeSq = stats.range * stats.range;

  let bestEnemy: EnemyInstance | null = null;
  let bestScore = -Infinity;

  for (const enemy of state.enemies) {
    if (enemy.hp <= 0) continue;
    const pos = getEnemyPosition(state, enemy);
    const d2 = distSq(towerPos.x, towerPos.y, pos.x, pos.y);
    if (d2 > rangeSq) continue;

    let score = 0;
    if (tower.targeting === 'first') {
      score = enemy.pathIndex + enemy.progress;
    } else {
      // closest
      score = -d2;
    }
    if (score > bestScore) {
      bestScore = score;
      bestEnemy = enemy;
    }
  }

  if (!bestEnemy) {
    return { tower, projectiles: [] };
  }

  const enemyPos = getEnemyPosition(state, bestEnemy);
  const speed = stats.projectileSpeed;
  const isInstant = speed >= 900;

  const slowMultiplier = stats.slowMultiplier ?? null;
  const slowDurationTicks = slowMultiplier ? 70 : 0;

  const proj: ProjectileInstance = {
    id: uuid('proj'),
    from: { x: towerPos.x, y: towerPos.y },
    toEnemyId: bestEnemy.id,
    isInstant,
    x: towerPos.x,
    y: towerPos.y,
    vx: 0,
    vy: 0,
    damage: stats.damage,
    splashRadius: stats.splashRadius ?? 0,
    slowMultiplier,
    slowDurationTicks,
  };

  if (!isInstant) {
    const dx = enemyPos.x - towerPos.x;
    const dy = enemyPos.y - towerPos.y;
    const len = Math.hypot(dx, dy) || 1;
    proj.vx = (dx / len) * speed;
    proj.vy = (dy / len) * speed;
  } else {
    proj.vx = 0;
    proj.vy = 0;
  }

  return {
    tower: { ...tower, cooldownRemainingTicks: stats.fireCooldownTicks },
    projectiles: [proj],
  };
}

function hitProjectile(state: GameState, projectile: ProjectileInstance) {
  const target = state.enemies.find((e) => e.id === projectile.toEnemyId);
  const hitPos = target ? getEnemyPosition(state, target) : { x: projectile.x, y: projectile.y };
  const splashSq = projectile.splashRadius > 0 ? projectile.splashRadius * projectile.splashRadius : 0;

  for (const enemy of state.enemies) {
    if (enemy.hp <= 0) continue;
    const pos = getEnemyPosition(state, enemy);
    const d2 = distSq(hitPos.x, hitPos.y, pos.x, pos.y);
    if (enemy.id === projectile.toEnemyId || (splashSq > 0 && d2 <= splashSq)) {
      applyDamage(enemy, projectile.damage);
      if (projectile.slowMultiplier) {
        applySlow(enemy, projectile.slowMultiplier, projectile.slowDurationTicks);
      }
    }
  }
}

export function simulateTowerTick(prev: GameState): GameState {
  let next: GameState = {
    ...prev,
    tick: prev.tick + 1,
  };

  if (prev.waveState === 'game_over') return next;

  // Clone arrays for mutation-based simulation
  const enemies = prev.enemies.map((e) => ({ ...e }));
  const projectiles = prev.projectiles.map((p) => ({ ...p }));
  next = { ...next, enemies, projectiles };

  // ---------------------------------------------------------------------------
  // Wave spawning
  // ---------------------------------------------------------------------------
  if (next.waveState === 'spawning' || next.waveState === 'in_progress') {
    const q = next.waveSpawnQueue.map((i) => ({ ...i }));
    if (q.length > 0) {
      q[0]!.ticksUntilSpawn -= 1;
      while (q.length > 0 && q[0]!.ticksUntilSpawn <= 0) {
        const item = q.shift()!;
        enemies.push(spawnEnemy(next, item.enemyType));
        if (q.length > 0) {
          // leave next interval as-is; it was authored as relative delay
        }
      }
    }

    next.waveSpawnQueue = q;

    if (next.waveState === 'spawning' && q.length === 0) {
      next.waveState = 'in_progress';
    }
  }

  // ---------------------------------------------------------------------------
  // Enemy movement + leaks
  // ---------------------------------------------------------------------------
  let lives = next.lives;
  let leaks = next.stats.leaks;

  for (const enemy of enemies) {
    if (enemy.hp <= 0) continue;

    // Update slow debuff
    if (enemy.slowRemainingTicks > 0) {
      enemy.slowRemainingTicks -= 1;
      if (enemy.slowRemainingTicks <= 0) {
        enemy.slowMultiplier = 1;
      }
    }

    const speed = enemy.speedTilesPerSecond * enemy.slowMultiplier;
    let dist = speed * BASE_DT_SECONDS;

    while (dist > 0 && !isEnemyAtBase(next, enemy)) {
      const remaining = 1 - enemy.progress;
      if (dist < remaining) {
        enemy.progress += dist;
        dist = 0;
      } else {
        dist -= remaining;
        enemy.pathIndex += 1;
        enemy.progress = 0;
      }
    }

    if (isEnemyAtBase(next, enemy)) {
      // leak
      const baseDamage = enemy.type === 'boss' ? 5 : 1;
      lives -= baseDamage;
      leaks += baseDamage;
      enemy.hp = 0;
    }
  }

  next.lives = lives;
  next.stats = { ...next.stats, leaks };

  // Remove dead enemies before targeting (but after leak logic)
  const aliveEnemies = enemies.filter((e) => e.hp > 0);
  next.enemies = aliveEnemies;

  // ---------------------------------------------------------------------------
  // Towers (cooldowns + fire)
  // ---------------------------------------------------------------------------
  let grid = prev.grid;
  let gridCloned = false;
  const newProjectiles: ProjectileInstance[] = [];

  function setTileTower(x: number, y: number, tower: TowerInstance | null) {
    if (!gridCloned) {
      grid = grid.map((row) => row.slice());
      gridCloned = true;
    }
    const row = grid[y];
    if (!row) return;
    const oldTile = row[x];
    if (!oldTile) return;
    row[x] = { ...oldTile, tower };
  }

  for (let y = 0; y < prev.gridSize; y++) {
    for (let x = 0; x < prev.gridSize; x++) {
      const tile = prev.grid[y]![x]!;
      if (!tile.tower) continue;
      const tower = tile.tower;

      // Only fire when there are enemies and wave running
      if (next.waveState !== 'spawning' && next.waveState !== 'in_progress') {
        const cd = Math.max(0, tower.cooldownRemainingTicks - 1);
        if (cd !== tower.cooldownRemainingTicks) setTileTower(x, y, { ...tower, cooldownRemainingTicks: cd });
        continue;
      }

      const towerPos = { x: x + 0.5, y: y + 0.5 };
      const { tower: updatedTower, projectiles: fired } = tryFireTower({ ...next, enemies: aliveEnemies }, tower, towerPos);
      if (updatedTower.cooldownRemainingTicks !== tower.cooldownRemainingTicks) {
        setTileTower(x, y, updatedTower);
      }
      newProjectiles.push(...fired);
    }
  }

  next.grid = grid;
  next.projectiles = [...projectiles, ...newProjectiles];

  // ---------------------------------------------------------------------------
  // Projectiles
  // ---------------------------------------------------------------------------
  const remainingProjectiles: ProjectileInstance[] = [];
  let money = next.money;
  let kills = next.stats.kills;
  let earned = next.stats.moneyEarned;

  for (const proj of next.projectiles) {
    const target = next.enemies.find((e) => e.id === proj.toEnemyId);
    if (!target || target.hp <= 0) {
      continue;
    }

    const targetPos = getEnemyPosition(next, target);
    const dx = targetPos.x - proj.x;
    const dy = targetPos.y - proj.y;
    const d2 = dx * dx + dy * dy;

    const hitRadius = 0.16;

    if (proj.isInstant || d2 <= hitRadius * hitRadius) {
      hitProjectile(next, proj);
      continue;
    }

    // Homing movement toward target
    const speed = Math.hypot(proj.vx, proj.vy);
    const len = Math.hypot(dx, dy) || 1;
    const vx = (dx / len) * speed;
    const vy = (dy / len) * speed;
    const x = proj.x + vx * BASE_DT_SECONDS;
    const y = proj.y + vy * BASE_DT_SECONDS;
    remainingProjectiles.push({ ...proj, x, y, vx, vy });
  }

  next.projectiles = remainingProjectiles;

  // Cleanup dead enemies + rewards
  const postDamageEnemies = next.enemies.filter((e) => e.hp > 0);
  const dead = next.enemies.filter((e) => e.hp <= 0);
  if (dead.length > 0) {
    for (const d of dead) {
      if (isEnemyAtBase(next, d)) continue; // leaks don't pay
      money += d.reward;
      earned += d.reward;
      kills += 1;
    }
  }
  next.enemies = postDamageEnemies;
  next.money = money;
  next.stats = { ...next.stats, kills, moneyEarned: earned };

  // ---------------------------------------------------------------------------
  // Wave completion / game over
  // ---------------------------------------------------------------------------
  if ((next.waveState === 'spawning' || next.waveState === 'in_progress') && next.waveSpawnQueue.length === 0 && next.enemies.length === 0) {
    next.waveState = next.stats.wave >= FINAL_WAVE_NUMBER ? 'victory' : 'complete';
    if (next.waveState === 'victory') next.speed = 0;
  }

  if (next.lives <= 0 && next.waveState !== 'game_over') {
    next.waveState = 'game_over';
    next.speed = 0;
  }

  return next;
}

export function startWaveState(prev: GameState): GameState {
  if (prev.waveState === 'game_over') return prev;
  if (prev.waveState === 'victory') return prev;
  if (prev.waveState !== 'idle' && prev.waveState !== 'complete') return prev;
  const nextWave = prev.stats.wave + 1;
  const queue = buildSpawnQueue(prev, nextWave);
  return {
    ...prev,
    waveState: 'spawning',
    waveSpawnQueue: queue,
    stats: { ...prev.stats, wave: nextWave },
  };
}

