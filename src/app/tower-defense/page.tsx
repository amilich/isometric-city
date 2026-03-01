'use client';

import { type MouseEvent, useCallback, useEffect, useRef, useState } from 'react';

type TowerType = 'cannon' | 'rapid';

type Point = { x: number; y: number };
type Enemy = {
  id: number;
  pathDistance: number;
  health: number;
  maxHealth: number;
  speed: number;
};
type Tower = {
  id: number;
  type: TowerType;
  col: number;
  row: number;
  cooldown: number;
};
type Projectile = {
  id: number;
  towerType: TowerType;
  x: number;
  y: number;
  targetId: number;
  speed: number;
  damage: number;
};

type GameState = {
  coins: number;
  lives: number;
  wave: number;
  waveInProgress: boolean;
  spawnTimer: number;
  enemiesSpawned: number;
  enemiesToSpawn: number;
  enemies: Enemy[];
  towers: Tower[];
  projectiles: Projectile[];
  enemyId: number;
  towerId: number;
  projectileId: number;
  gameOver: boolean;
};

const BOARD_COLS = 15;
const BOARD_ROWS = 10;
const TILE = 56;
const BOARD_WIDTH = BOARD_COLS * TILE;
const BOARD_HEIGHT = BOARD_ROWS * TILE;

const PATH_CELLS: Point[] = [
  { x: 0, y: 2 },
  { x: 3, y: 2 },
  { x: 3, y: 7 },
  { x: 7, y: 7 },
  { x: 7, y: 4 },
  { x: 12, y: 4 },
  { x: 12, y: 8 },
];

const PATH_POINTS = PATH_CELLS.map((cell) => ({
  x: cell.x * TILE + TILE * 0.5,
  y: cell.y * TILE + TILE * 0.5,
}));

const TILE_PATH: Set<string> = new Set(
  PATH_CELLS.map((cell) => `${cell.x},${cell.y}`)
);

const PATH_SEGMENTS = PATH_POINTS.slice(0, -1).map((start, index) => {
  const end = PATH_POINTS[index + 1]!;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  return { start, end, dx, dy, length };
});

const PATH_TOTAL_LENGTH = PATH_SEGMENTS.reduce((acc, segment) => acc + segment.length, 0);

const TOWER_CONFIG: Record<TowerType, {
  name: string;
  cost: number;
  range: number;
  cooldown: number;
  color: string;
  radius: number;
  bulletSpeed: number;
  damage: number;
}> = {
  cannon: {
    name: 'Cannon',
    cost: 45,
    range: 170,
    cooldown: 0.75,
    color: 'hsl(214, 93%, 68%)',
    radius: 15,
    bulletSpeed: 260,
    damage: 28,
  },
  rapid: {
    name: 'Rapid',
    cost: 72,
    range: 110,
    cooldown: 0.22,
    color: 'hsl(158, 75%, 60%)',
    radius: 10,
    bulletSpeed: 420,
    damage: 12,
  },
};

const INITIAL_GAME_STATE: GameState = {
  coins: 140,
  lives: 18,
  wave: 1,
  waveInProgress: false,
  spawnTimer: 0,
  enemiesSpawned: 0,
  enemiesToSpawn: 0,
  enemies: [],
  towers: [],
  projectiles: [],
  enemyId: 1,
  towerId: 1,
  projectileId: 1,
  gameOver: false,
};

function isOnPath(col: number, row: number) {
  return TILE_PATH.has(`${col},${row}`);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getPositionFromDistance(distance: number): Point {
  let remaining = Math.max(0, distance);
  if (remaining <= 0) return { ...PATH_POINTS[0]! };

  for (const segment of PATH_SEGMENTS) {
    if (remaining <= segment.length) {
      const t = segment.length === 0 ? 0 : remaining / segment.length;
      return {
        x: segment.start.x + segment.dx * t,
        y: segment.start.y + segment.dy * t,
      };
    }
    remaining -= segment.length;
  }

  return { ...PATH_POINTS[PATH_POINTS.length - 1]! };
}

function drawHealthBar(ctx: CanvasRenderingContext2D, x: number, y: number, ratio: number) {
  const width = TILE * 0.7;
  const height = 6;
  const left = x - width / 2;
  const top = y - TILE * 0.4;

  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(left, top, width, height);
  ctx.fillStyle = ratio > 0.5 ? '#22c55e' : ratio > 0.25 ? '#f59e0b' : '#ef4444';
  ctx.fillRect(left, top, width * ratio, height);
}

function renderFrame(ctx: CanvasRenderingContext2D, state: GameState) {
  ctx.clearRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
  ctx.fillStyle = '#081425';
  ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;

  for (let row = 0; row < BOARD_ROWS; row += 1) {
    for (let col = 0; col < BOARD_COLS; col += 1) {
      const x = col * TILE;
      const y = row * TILE;
      if (isOnPath(col, row)) {
        ctx.fillStyle = 'rgba(255, 236, 153, 0.18)';
        ctx.fillRect(x, y, TILE, TILE);
      }
      ctx.strokeRect(x, y, TILE, TILE);
    }
  }

  // Draw path line to make route obvious
  ctx.strokeStyle = 'rgba(250, 204, 21, 0.7)';
  ctx.lineWidth = 8;
  ctx.beginPath();
  PATH_POINTS.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.stroke();

  // Draw towers
  for (const tower of state.towers) {
    const config = TOWER_CONFIG[tower.type];
    const centerX = tower.col * TILE + TILE / 2;
    const centerY = tower.row * TILE + TILE / 2;

    ctx.fillStyle = config.color;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(tower.type === 'cannon' ? 'C' : 'R', centerX, centerY + 3);
  }

  // Draw enemies
  for (const enemy of state.enemies) {
    const position = getPositionFromDistance(enemy.pathDistance);
    const hpRatio = enemy.health / enemy.maxHealth;

    ctx.fillStyle = hpRatio > 0.6 ? '#dc2626' : hpRatio > 0.3 ? '#f59e0b' : '#9333ea';
    ctx.beginPath();
    ctx.arc(position.x, position.y, 14, 0, Math.PI * 2);
    ctx.fill();

    drawHealthBar(ctx, position.x, position.y, clamp(hpRatio, 0, 1));
  }

  // Draw projectiles
  for (const projectile of state.projectiles) {
    const color = TOWER_CONFIG[projectile.towerType].color;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(projectile.x, projectile.y, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function simulate(state: GameState, dt: number): GameState {
  if (state.gameOver) return state;

  const enemies = [...state.enemies];
  const projectiles = [...state.projectiles];
  const towers = [...state.towers];

  let coins = state.coins;
  let lives = state.lives;
  let spawnTimer = state.waveInProgress ? state.spawnTimer + dt : 0;
  let enemiesSpawned = state.enemiesSpawned;
  let enemyId = state.enemyId;

  const liveEnemies: Enemy[] = [];
  const enemyPositions = new Map<number, Point>();

  if (state.waveInProgress && enemiesSpawned < state.enemiesToSpawn && spawnTimer >= 0.55) {
    const enemyHealth = 70 + state.wave * 16;
    const enemySpeed = 55 + state.wave * 2;
    enemies.push({
      id: enemyId,
      pathDistance: 0,
      health: enemyHealth,
      maxHealth: enemyHealth,
      speed: enemySpeed,
    });
    enemyId += 1;
    enemiesSpawned += 1;
    spawnTimer = 0;
  }

  for (const enemy of enemies) {
    const newDistance = enemy.pathDistance + enemy.speed * dt;
    if (newDistance >= PATH_TOTAL_LENGTH) {
      lives -= 1;
      continue;
    }

    const moved = { ...enemy, pathDistance: newDistance };
    enemyPositions.set(moved.id, getPositionFromDistance(newDistance));
    liveEnemies.push(moved);
  }
  if (lives <= 0) lives = 0;

  const spawnedProjectiles: Projectile[] = [];
  const newTowers = towers.map((tower) => {
    const config = TOWER_CONFIG[tower.type];
    const nextCooldown = Math.max(0, tower.cooldown - dt);

    if (!state.waveInProgress || liveEnemies.length === 0 || nextCooldown > 0) {
      return { ...tower, cooldown: nextCooldown };
    }

    const towerX = tower.col * TILE + TILE / 2;
    const towerY = tower.row * TILE + TILE / 2;

    const target = liveEnemies.find((enemy) => {
      const position = enemyPositions.get(enemy.id);
      if (!position) return false;
      const dx = position.x - towerX;
      const dy = position.y - towerY;
      return Math.hypot(dx, dy) <= config.range;
    });

    if (!target) return { ...tower, cooldown: nextCooldown };

    const targetPos = enemyPositions.get(target.id);
    if (!targetPos) return { ...tower, cooldown: nextCooldown };

    spawnedProjectiles.push({
      id: state.projectileId + spawnedProjectiles.length,
      towerType: tower.type,
      x: towerX,
      y: towerY,
      targetId: target.id,
      speed: config.bulletSpeed,
      damage: config.damage,
    });

    return { ...tower, cooldown: config.cooldown };
  });

  const damageToApply = new Map<number, number>();
  const liveProjectiles: Projectile[] = [];

  for (const projectile of projectiles.concat(spawnedProjectiles)) {
    const targetPos = enemyPositions.get(projectile.targetId);
    if (!targetPos) {
      continue;
    }

    const dx = targetPos.x - projectile.x;
    const dy = targetPos.y - projectile.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= 12) {
      damageToApply.set(
        projectile.targetId,
        (damageToApply.get(projectile.targetId) || 0) + projectile.damage
      );
      continue;
    }

    const normalizedX = distance === 0 ? 0 : dx / distance;
    const normalizedY = distance === 0 ? 0 : dy / distance;
    const travel = projectile.speed * dt;
    const nextX = projectile.x + normalizedX * travel;
    const nextY = projectile.y + normalizedY * travel;

    liveProjectiles.push({
      ...projectile,
      x: nextX,
      y: nextY,
    });
  }

  const enemiesAlive: Enemy[] = [];
  for (const enemy of liveEnemies) {
    const damage = damageToApply.get(enemy.id) || 0;
    const health = enemy.health - damage;
    if (health <= 0) {
      coins += 14 + state.wave * 4;
      continue;
    }
    enemiesAlive.push({ ...enemy, health });
  }

  let waveInProgress = state.waveInProgress;
  let wave = state.wave;
  if (
    waveInProgress &&
    enemiesSpawned >= state.enemiesToSpawn &&
    enemiesAlive.length === 0 &&
    liveProjectiles.length === 0
  ) {
    waveInProgress = false;
    wave += 1;
    coins += 35;
    enemiesSpawned = 0;
    spawnTimer = 0;
  }

  return {
    ...state,
    coins,
    lives,
    wave,
    waveInProgress,
    spawnTimer,
    enemiesSpawned,
    enemies: enemiesAlive,
    enemiesToSpawn: state.enemiesToSpawn,
    towers: newTowers,
    projectiles: liveProjectiles,
    gameOver: lives <= 0,
    enemyId,
    projectileId: state.projectileId + spawnedProjectiles.length,
  };
}

function createInitialState(): GameState {
  return {
    ...INITIAL_GAME_STATE,
    enemyId: 1,
    towerId: 1,
    projectileId: 1,
  };
}

export default function TowerDefensePage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [selectedTower, setSelectedTower] = useState<TowerType>('cannon');
  const [gameState, setGameState] = useState<GameState>(createInitialState);
  const [hudTick, setHudTick] = useState(0);
  const [message, setMessage] = useState('Pick a tower and place it to stop the wave.');

  const setMessageFor = useCallback((text: string) => {
    setMessage(text);
    const timeout = window.setTimeout(() => {
      setMessage((current) => (current === text ? '' : current));
    }, 1400);
    return timeout;
  }, []);

  const handleCanvasClick = useCallback(
    (event: MouseEvent<HTMLCanvasElement>) => {
      if (gameState.gameOver) return;

      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = (event.clientX - rect.left) * (BOARD_WIDTH / rect.width);
      const y = (event.clientY - rect.top) * (BOARD_HEIGHT / rect.height);

      const col = Math.floor(clamp(x, 0, BOARD_WIDTH - 1) / TILE);
      const row = Math.floor(clamp(y, 0, BOARD_HEIGHT - 1) / TILE);
      if (col < 0 || col >= BOARD_COLS || row < 0 || row >= BOARD_ROWS) return;
      if (isOnPath(col, row)) {
        setMessageFor('Can\'t place on the road.');
        return;
      }
      if (gameState.towers.some((tower) => tower.col === col && tower.row === row)) {
        setMessageFor('That tile already has a tower.');
        return;
      }

      const blueprint = TOWER_CONFIG[selectedTower];
      if (gameState.coins < blueprint.cost) {
        setMessageFor('Not enough coins.');
        return;
      }

      setGameState((state) => ({
        ...state,
        coins: state.coins - blueprint.cost,
        towers: [
          ...state.towers,
          {
            id: state.towerId,
            type: selectedTower,
            col,
            row,
            cooldown: 0,
          },
        ],
        towerId: state.towerId + 1,
      }));
      setMessage(`Placed ${blueprint.name} for ${blueprint.cost} coins.`);
    },
    [gameState.coins, gameState.towers, selectedTower, gameState.gameOver, setMessageFor]
  );

  const startWave = useCallback(() => {
    setGameState((state) => {
      if (state.waveInProgress || state.gameOver) return state;
      return {
        ...state,
        waveInProgress: true,
        spawnTimer: 0,
        enemiesSpawned: 0,
        enemiesToSpawn: 8 + state.wave * 2,
        enemies: [],
        projectiles: [],
      };
    });
  }, []);

  const resetGame = useCallback(() => {
    setGameState(createInitialState());
    setMessage('Fresh wave commander ready.');
    setHudTick((tick) => tick + 1);
  }, [setMessage]);

  useEffect(() => {
    const gameLoop = (timestamp: number) => {
      const last = (window as unknown as { __towerDefenseLastTick?: number }).__towerDefenseLastTick || timestamp;
      const delta = Math.min(0.05, (timestamp - last) / 1000);
      (window as unknown as { __towerDefenseLastTick?: number }).__towerDefenseLastTick = timestamp;

      setGameState((state) => simulate(state, delta));
      setHudTick((tick) => tick + 1);
      requestAnimationFrame(gameLoop);
    };

    const handle = requestAnimationFrame(gameLoop);
    return () => {
      cancelAnimationFrame(handle);
      (window as unknown as { __towerDefenseLastTick?: number }).__towerDefenseLastTick = undefined;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = BOARD_WIDTH * dpr;
    canvas.height = BOARD_HEIGHT * dpr;
    canvas.style.width = `${BOARD_WIDTH}px`;
    canvas.style.height = `${BOARD_HEIGHT}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderFrame(ctx, gameState);
  }, [gameState, hudTick]);

  useEffect(() => {
    if (gameState.waveInProgress) {
      setMessageFor('Wave running—place wisely and hold the line.');
    }
  }, [gameState.waveInProgress, setMessageFor]);

  return (
    <div className="min-h-screen bg-slate-950 text-white px-4 py-6">
      <div className="mx-auto w-full max-w-[1040px]">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/80">Tower Defense</p>
            <h1 className="text-3xl font-semibold text-cyan-100">Citadel Outpost</h1>
          </div>
          <div className="text-sm text-slate-200 flex flex-wrap gap-3">
            <span className="rounded bg-slate-800 px-3 py-1">Wave {gameState.wave}</span>
            <span className="rounded bg-slate-800 px-3 py-1">Coins {gameState.coins}</span>
            <span className="rounded bg-slate-800 px-3 py-1">Lives {gameState.lives}</span>
            <span className="rounded bg-slate-800 px-3 py-1">Towers {gameState.towers.length}</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-700/70 bg-slate-900/80 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {(Object.keys(TOWER_CONFIG) as TowerType[]).map((towerType) => {
                const config = TOWER_CONFIG[towerType];
                const isSelected = selectedTower === towerType;
                return (
                  <button
                    key={towerType}
                    type="button"
                    onClick={() => setSelectedTower(towerType)}
                    className={`rounded-md border px-3 py-2 text-sm ${
                      isSelected
                        ? 'border-cyan-200 bg-cyan-400/15 text-cyan-100'
                        : 'border-slate-600 text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    {config.name} ({config.cost})
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={startWave}
                disabled={gameState.waveInProgress || gameState.gameOver}
                className="rounded-md bg-emerald-500/90 px-4 py-2 text-sm font-medium text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {gameState.waveInProgress ? 'Wave in progress' : 'Start next wave'}
              </button>
              <button
                onClick={resetGame}
                className="rounded-md bg-slate-700 px-4 py-2 text-sm text-white transition hover:bg-slate-600"
              >
                Restart
              </button>
            </div>
          </div>

          <div className="mt-3 min-h-6 text-sm text-cyan-100/80">
            {message || (gameState.waveInProgress ? 'Defend the path! Enemies move right-to-left along the road.' : 'Ready to deploy.')}
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            className="cursor-crosshair rounded-xl border border-cyan-300/20 bg-slate-900 shadow-xl"
          />
          <aside className="space-y-3 text-sm text-slate-200">
            <div className="rounded-md border border-slate-700 bg-slate-900/70 p-3">
              <h2 className="mb-2 font-semibold text-cyan-100">Quick Controls</h2>
              <ul className="space-y-2">
                <li>• Left click path: place selected tower.</li>
                <li>• Start Wave: begin current wave.</li>
                <li>• Restart: clear board and start over.</li>
                <li>• Fast enemies mean you need tighter spacing.</li>
              </ul>
            </div>
            <div className="rounded-md border border-slate-700 bg-slate-900/70 p-3">
              <h2 className="mb-2 font-semibold text-cyan-100">Tower Stats</h2>
              {(Object.keys(TOWER_CONFIG) as TowerType[]).map((type) => {
                const cfg = TOWER_CONFIG[type];
                return (
                  <div key={type} className="mb-2 last:mb-0">
                    <div className="font-medium text-cyan-100">{cfg.name}</div>
                    <p className="text-xs text-slate-300">
                      Cost {cfg.cost} • Range {cfg.range}px • Damage {cfg.damage} • Fire {Math.round((1 / cfg.cooldown))}/s
                    </p>
                  </div>
                );
              })}
            </div>
            <div className="rounded-md border border-slate-700 bg-slate-900/70 p-3">
              <h2 className="mb-2 font-semibold text-cyan-100">Status</h2>
              {gameState.gameOver ? (
                <p className="text-red-300">Base failed. Press restart.</p>
              ) : gameState.waveInProgress ? (
                <p className="text-emerald-200">Wave active — hold the line.</p>
              ) : (
                <p className="text-slate-200">Wave complete. Click next wave when ready.</p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
