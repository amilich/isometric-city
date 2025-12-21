import { createCompetitiveGameState, simulateTick } from '../src/lib/simulation';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function run() {
  // Create
  const created = createCompetitiveGameState('Test', 35);
  assert(created.gameMode === 'competitive', 'Expected gameMode=competitive');
  assert(!!created.competitive, 'Expected competitive state to exist');
  assert((created.competitive?.players.length ?? 0) >= 3, 'Expected 3+ players');
  assert((created.competitive?.units.length ?? 0) > 0, 'Expected initial units');
  assert(created.competitive?.fog.revealed.length === created.gridSize, 'Expected fog grid sized to map');

  // Attack -> ignite -> burn down -> eliminate
  let state = createCompetitiveGameState('Test', 35);
  const comp = state.competitive!;
  const humanId = comp.humanPlayerId;
  const enemy = comp.players.find(p => !p.isHuman);
  assert(!!enemy, 'Expected an AI enemy');

  const attacker = comp.units.find(u => u.ownerId === humanId);
  assert(!!attacker, 'Expected a human unit');

  attacker.attackDamagePerTick = 999;
  attacker.igniteChancePerHit = 1;
  attacker.order = { kind: 'attack', target: { x: enemy.base.x, y: enemy.base.y } };

  const baseTile = state.grid[enemy.base.y][enemy.base.x];
  baseTile.building.ownerId = enemy.id;
  baseTile.building.hp = 1;
  baseTile.building.maxHp = 1;
  baseTile.building.onFire = false;
  baseTile.building.fireProgress = 0;

  for (let i = 0; i < 40; i++) {
    state = simulateTick(state);
  }

  assert(state.grid[enemy.base.y][enemy.base.x].building.type === 'grass', 'Expected enemy city hall tile to burn down to grass');
  const enemyAfter = state.competitive!.players.find(p => p.id === enemy.id);
  assert(!!enemyAfter?.eliminated, 'Expected enemy to be eliminated after city hall destruction');

  // Fog reveal around friendly units
  let fogState = createCompetitiveGameState('Test', 35);
  const fogComp = fogState.competitive!;
  const u = fogComp.units.find(x => x.ownerId === fogComp.humanPlayerId);
  assert(!!u, 'Expected a human unit for fog test');
  const tx = Math.min(fogState.gridSize - 5, u.x + 12);
  const ty = Math.min(fogState.gridSize - 5, u.y + 10);
  u.x = tx;
  u.y = ty;
  fogState = simulateTick(fogState);
  assert(fogState.competitive!.fog.revealed[Math.floor(ty)][Math.floor(tx)] === true, 'Expected fog to be revealed around unit');
}

try {
  run();
  console.log('Competitive smoke tests: OK');
} catch (e) {
  console.error('Competitive smoke tests: FAILED');
  console.error(e);
  process.exitCode = 1;
}

