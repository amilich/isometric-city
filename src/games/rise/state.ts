import { BASE_RESOURCES, BUILDING_COSTS, BUILDING_HP, BUILDING_AGE_REQ, DIFFICULTY_GATHER_MULT, GATHER_RATES, POP_COST, SPEED_MULTIPLIERS, UNIT_AGE_REQ, UNIT_COSTS } from './constants';
import { GridPosition } from '@/core/types';
import {
  AgeId,
  AGE_ORDER,
  PlayerState,
  ResourcePool,
  ResourceNodeType,
  RiseBuilding,
  RiseBuildingType,
  RiseGameState,
  RiseTile,
  RiseUnit,
  RiseUnitType,
  TerrainType,
  UnitOrder,
} from './types';
import { BUILDING_POP_BONUS } from './constants';
import { msg } from 'gt-next';

function newId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    // @ts-ignore
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function recomputeTerritory(grid: RiseTile[][], buildings: RiseBuilding[], size: number): RiseTile[][] {
  const dist: number[][] = Array.from({ length: size }, () => Array(size).fill(Number.POSITIVE_INFINITY));
  const newGrid: RiseTile[][] = grid.map(row => row.map(t => ({ ...t, ownerId: undefined } as RiseTile)));
  const radiusByType: Partial<Record<RiseBuildingType, number>> = {
    city_center: 6,
    fort: 5,
    tower: 3,
    barracks: 2,
    factory: 2,
    siege_factory: 2,
    airbase: 2,
    market: 2,
    library: 2,
    university: 2,
    lumber_camp: 2,
    mine: 2,
    oil_rig: 2,
    house: 2,
    farm: 1,
  };

  for (const b of buildings) {
    const radius = radiusByType[b.type] ?? 2;
    for (let dy = -radius; dy <= radius; dy++) {
      const y = b.tile.y + dy;
      if (y < 0 || y >= size) continue;
      for (let dx = -radius; dx <= radius; dx++) {
        const x = b.tile.x + dx;
        if (x < 0 || x >= size) continue;
        const manhattan = Math.abs(dx) + Math.abs(dy);
        if (manhattan > radius) continue;
        if (manhattan >= dist[y][x]) continue;
        dist[y][x] = manhattan;
        newGrid[y][x].ownerId = b.ownerId;
      }
    }
  }

  // Ensure building tiles keep their owner even if radiusByType was 0
  for (const b of buildings) {
    const { x, y } = b.tile;
    if (x >= 0 && y >= 0 && x < size && y < size) {
      newGrid[y][x].ownerId = b.ownerId;
    }
  }

  return newGrid;
}

function isPassable(state: RiseGameState, x: number, y: number, ownerId: string): boolean {
  if (x < 0 || y < 0 || x >= state.gridSize || y >= state.gridSize) return false;
  const tile = state.tiles[y][x];
  if (tile.terrain === 'water') return false;
  if (tile.buildingId) {
    const b = state.buildings.find(bb => bb.id === tile.buildingId);
    if (!b) return false;
    if (b.ownerId !== ownerId) return false;
  }
  return true;
}

function findPath(state: RiseGameState, start: GridPosition, target: GridPosition, ownerId: string): GridPosition[] | null {
  const size = state.gridSize;
  const visited = new Set<number>();
  const queue: { x: number; y: number; path: GridPosition[] }[] = [{ x: start.x, y: start.y, path: [start] }];
  const dirs = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
  ];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur.x === target.x && cur.y === target.y) {
      return cur.path;
    }
    for (const { dx, dy } of dirs) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      const key = ny * size + nx;
      if (visited.has(key)) continue;
      if (!isPassable(state, nx, ny, ownerId)) continue;
      visited.add(key);
      queue.push({ x: nx, y: ny, path: [...cur.path, { x: nx, y: ny }] });
    }
  }
  return null;
}

function generateOffsets(count: number): GridPosition[] {
  const offsets: GridPosition[] = [];
  const rings = Math.ceil(Math.sqrt(count));
  let placed = 0;
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ];
  let radius = 0;
  while (placed < count) {
    if (radius === 0) {
      offsets.push({ x: 0, y: 0 });
      placed++;
      radius++;
      continue;
    }
    for (const [dx, dy] of dirs) {
      if (placed >= count) break;
      offsets.push({ x: dx * radius, y: dy * radius });
      placed++;
    }
    radius++;
  }
  return offsets.slice(0, count);
}

export function createEmptyGrid(size: number): RiseTile[][] {
  const tiles: RiseTile[][] = [];
  for (let y = 0; y < size; y++) {
    const row: RiseTile[] = [];
    for (let x = 0; x < size; x++) {
      row.push({
        x,
        y,
        terrain: 'grass',
      });
    }
    tiles.push(row);
  }
  return tiles;
}

function scatterNodes(tiles: RiseTile[][], type: ResourceNodeType, count: number, seedOffset = 0) {
  const size = tiles.length;
  let placed = 0;
  let attempts = 0;
  const maxAttempts = count * 20;

  while (placed < count && attempts < maxAttempts) {
    attempts++;
    const x = Math.floor(Math.random() * size);
    const y = Math.floor(Math.random() * size);
    const tile = tiles[y][x];
    // Keep away from very edges
    if (x < 3 || y < 3 || x > size - 4 || y > size - 4) continue;
    if (tile.node || tile.terrain !== 'grass') continue;

    tile.node = { type, amount: 99999 };
    if (type === 'forest') {
      tile.terrain = 'forest';
    } else if (type === 'mine') {
      tile.terrain = 'mountain';
    }
    placed++;
  }
}

function addInitialPlayers(): PlayerState[] {
  return [
    {
      id: 'player',
      name: msg('You'),
      color: '#38bdf8',
      age: 'classics',
      ageStartSeconds: 0,
      resources: { ...BASE_RESOURCES },
      controller: { isAI: false },
    },
    {
      id: 'ai',
      name: msg('AI'),
      color: '#f97316',
      age: 'classics',
      ageStartSeconds: 0,
      resources: { ...BASE_RESOURCES, wealth: 260, food: 260, wood: 260, metal: 160 },
      controller: { isAI: true, difficulty: 'medium' },
    },
  ];
}

function createBuilding(ownerId: string, type: RiseBuildingType, tileX: number, tileY: number): RiseBuilding {
  const hp = BUILDING_HP[type] ?? 500;
  return {
    id: newId(),
    type,
    ownerId,
    hp,
    maxHp: hp,
    tile: { x: tileX, y: tileY },
  };
}

function createUnit(ownerId: string, type: RiseUnitType, x: number, y: number): RiseUnit {
  const baseHp: Record<RiseUnitType, number> = {
    citizen: 50,
    infantry: 120,
    ranged: 90,
    vehicle: 240,
    siege: 260,
    air: 180,
  };
  const baseSpeed: Record<RiseUnitType, number> = {
    citizen: 2.2,
    infantry: 2.4,
    ranged: 2.4,
    vehicle: 3.4,
    siege: 2.0,
    air: 4.0,
  };
  const attack: Partial<Record<RiseUnitType, RiseUnit['attack']>> = {
    infantry: { damage: 9, range: 1.1, cooldown: 0.9, cooldownRemaining: 0 },
    ranged: { damage: 11, range: 3.2, cooldown: 1.2, cooldownRemaining: 0 },
    vehicle: { damage: 16, range: 1.6, cooldown: 1.0, cooldownRemaining: 0 },
    siege: { damage: 42, range: 4.6, cooldown: 3.8, cooldownRemaining: 0 },
    air: { damage: 20, range: 3.8, cooldown: 1.6, cooldownRemaining: 0 },
  };

  return {
    id: newId(),
    type,
    ownerId,
    position: { x, y },
    hp: baseHp[type],
    maxHp: baseHp[type],
    speed: baseSpeed[type],
    order: { kind: 'idle' },
    attack: attack[type],
  };
}

export function initializeRiseState(gridSize = 48): RiseGameState {
  const tiles = createEmptyGrid(gridSize);

  scatterNodes(tiles, 'forest', Math.floor(gridSize * 0.8));
  scatterNodes(tiles, 'mine', Math.floor(gridSize * 0.35));
  scatterNodes(tiles, 'fertile', Math.floor(gridSize * 0.6));
  scatterNodes(tiles, 'rare', Math.floor(gridSize * 0.2));
  scatterNodes(tiles, 'oil', 12);

  const players = addInitialPlayers();
  const buildings: RiseBuilding[] = [];

  // place starting city centers
  const playerCity = { x: Math.floor(gridSize * 0.55), y: Math.floor(gridSize * 0.55) };
  const aiCity = { x: Math.floor(gridSize * 0.25), y: Math.floor(gridSize * 0.25) };

  const playerCenter = createBuilding('player', 'city_center', playerCity.x, playerCity.y);
  tiles[playerCity.y][playerCity.x].buildingId = playerCenter.id;
  tiles[playerCity.y][playerCity.x].ownerId = 'player';
  buildings.push(playerCenter);

  const aiCenter = createBuilding('ai', 'city_center', aiCity.x, aiCity.y);
  tiles[aiCity.y][aiCity.x].buildingId = aiCenter.id;
  tiles[aiCity.y][aiCity.x].ownerId = 'ai';
  buildings.push(aiCenter);

  const units: RiseUnit[] = [
    createUnit('player', 'citizen', playerCity.x + 1, playerCity.y + 1),
    createUnit('player', 'citizen', playerCity.x + 2, playerCity.y),
    createUnit('ai', 'citizen', aiCity.x + 1, aiCity.y + 1),
    createUnit('ai', 'citizen', aiCity.x + 2, aiCity.y),
  ];

  const tilesWithTerritory = recomputeTerritory(tiles, buildings, gridSize);

  return {
    id: newId(),
    tick: 0,
    elapsedSeconds: 0,
    speed: 1,
    gridSize,
    tiles: tilesWithTerritory,
    players,
    units,
    buildings,
    selectedUnitIds: new Set<string>(),
    localPlayerId: 'player',
    aiEnabled: true,
    gameStatus: 'playing',
    lastDamageAt: undefined,
  };
}

export function canAfford(resources: ResourcePool, cost: Partial<ResourcePool>): boolean {
  for (const key of Object.keys(cost) as (keyof ResourcePool)[]) {
    if ((resources[key] ?? 0) < (cost[key] ?? 0)) return false;
  }
  return true;
}

export function payCost(resources: ResourcePool, cost: Partial<ResourcePool>): ResourcePool {
  const next = { ...resources };
  for (const key of Object.keys(cost) as (keyof ResourcePool)[]) {
    next[key] = Math.max(0, (next[key] ?? 0) - (cost[key] ?? 0));
  }
  return next;
}

export function spawnUnit(state: RiseGameState, ownerId: string, type: RiseUnitType, at: { x: number; y: number }): RiseGameState {
  if (state.gameStatus !== 'playing') return state;
  const player = state.players.find(p => p.id === ownerId);
  if (!player) return state;

  const minAge = UNIT_AGE_REQ[type] || 'classics';
  if (AGE_ORDER.indexOf(player.age) < AGE_ORDER.indexOf(minAge)) return state;

  const cost = UNIT_COSTS[type] as Partial<ResourcePool> | undefined;
  const pop = POP_COST[type] ?? 1;
  if (!cost) return state;
  if (player.resources.population + pop > player.resources.popCap) return state;
  if (!canAfford(player.resources, cost)) return state;

  const newResources = payCost(player.resources, cost);
  newResources.population += pop;

  const unit = createUnit(ownerId, type, at.x, at.y);
  return {
    ...state,
    players: state.players.map(p => (p.id === ownerId ? { ...p, resources: newResources } : p)),
    units: [...state.units, unit],
  };
}

export function placeBuilding(state: RiseGameState, ownerId: string, type: RiseBuildingType, tileX: number, tileY: number): RiseGameState {
  if (state.gameStatus !== 'playing') return state;
  const player = state.players.find(p => p.id === ownerId);
  if (!player) return state;

  const cost = BUILDING_COSTS[type];
  if (!cost || !canAfford(player.resources, cost)) return state;

  const grid = state.tiles;
  if (tileX < 0 || tileY < 0 || tileX >= grid.length || tileY >= grid.length) return state;
  if (grid[tileY][tileX].buildingId) return state;

  // placement rules
  if (type === 'farm') {
    const node = grid[tileY][tileX].node;
    if (!node || node.type !== 'fertile') return state;
  }
  // oil rig gating
  if (type === 'oil_rig') {
    const node = grid[tileY][tileX].node;
    if (!node || node.type !== 'oil') return state;
  }
  // age requirement
  const minAge = BUILDING_AGE_REQ[type] || 'classics';
  if (AGE_ORDER.indexOf(player.age) < AGE_ORDER.indexOf(minAge)) return state;

  const building = createBuilding(ownerId, type, tileX, tileY);
  const newResources = payCost(player.resources, cost);
  const popBonus = BUILDING_POP_BONUS[type] ?? 0;
  if (popBonus) {
    newResources.popCap += popBonus;
  }

  const newGrid = grid.map(row => row.slice());
  newGrid[tileY] = [...grid[tileY]];
  newGrid[tileY][tileX] = { ...grid[tileY][tileX], buildingId: building.id, ownerId };

  const updatedBuildings = [...state.buildings, building];
  const territory = recomputeTerritory(newGrid, updatedBuildings, state.gridSize);

  return {
    ...state,
    tiles: territory,
    players: state.players.map(p => (p.id === ownerId ? { ...p, resources: newResources } : p)),
    buildings: updatedBuildings,
  };
}

export function tickState(state: RiseGameState, deltaSeconds: number): RiseGameState {
  if (state.gameStatus !== 'playing') return state;
  if (state.speed === 0) return state;
  const speedMult = SPEED_MULTIPLIERS[state.speed];
  const scaledDelta = deltaSeconds * speedMult;
  const localId = state.localPlayerId;
  let underAttackAt = state.lastDamageAt;

  let updatedUnits: RiseUnit[] = [];
  const updatedPlayers = state.players.map(p => ({ ...p }));
  const grid = state.tiles;

  function addResource(ownerId: string, key: keyof ResourcePool, amount: number) {
    const p = updatedPlayers.find(pl => pl.id === ownerId);
    if (!p) return;
    const mult = p.controller.difficulty ? DIFFICULTY_GATHER_MULT[p.controller.difficulty] ?? 1 : 1;
    p.resources[key] += amount * scaledDelta * mult;
  }

  const buildingsById = new Map(state.buildings.map(b => [b.id, b]));
  const unitsById = new Map(state.units.map(u => [u.id, u]));

  for (const unit of state.units) {
    let newUnit = { ...unit };

    // Move
    if (newUnit.order.kind === 'move' || newUnit.order.kind === 'gather' || newUnit.order.kind === 'attack') {
      const path = newUnit.order.path;
      const target = newUnit.order.target;
      let targetPos = target;

      if (path && newUnit.pathIndex !== undefined && newUnit.pathIndex < path.length) {
        targetPos = path[newUnit.pathIndex];
      }

      const dx = targetPos.x - newUnit.position.x;
      const dy = targetPos.y - newUnit.position.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.01) {
        const step = newUnit.speed * scaledDelta;
        const ratio = Math.min(1, step / dist);
        newUnit.position = { x: newUnit.position.x + dx * ratio, y: newUnit.position.y + dy * ratio };
      } else {
        // arrived at waypoint
        if (path && newUnit.pathIndex !== undefined && newUnit.pathIndex < path.length - 1) {
          newUnit.pathIndex = (newUnit.pathIndex ?? 0) + 1;
        } else {
          // Final arrival
          if (newUnit.order.kind === 'move') {
            newUnit.order = { kind: 'idle' };
          } else if (newUnit.order.kind === 'gather') {
            const tx = Math.round(target.x);
            const ty = Math.round(target.y);
            const node = grid[ty]?.[tx]?.node;
            if (node) {
              const owner = updatedPlayers.find(p => p.id === newUnit.ownerId);
              const ownerAgeIndex = owner ? AGE_ORDER.indexOf(owner.age) : 0;
              const oilAllowed = ownerAgeIndex >= AGE_ORDER.indexOf('industrial');
              if (node.type !== 'oil' || oilAllowed) {
                const rate = GATHER_RATES.citizen[node.type] ?? 0;
                if (rate > 0) {
                  const resourceKey =
                    node.type === 'forest' ? 'wood' :
                    node.type === 'mine' ? 'metal' :
                    node.type === 'oil' ? 'oil' :
                    node.type === 'fertile' ? 'food' : 'wealth';
                  addResource(newUnit.ownerId, resourceKey as keyof ResourcePool, rate);
                }
              }
            }
          }
        }
      }
    }

    // Attack cooldown decrement
    if (newUnit.attack) {
      newUnit.attack = { ...newUnit.attack, cooldownRemaining: Math.max(0, newUnit.attack.cooldownRemaining - scaledDelta) };
    }

    // Resolve attack damage if in range
    if (newUnit.order.kind === 'attack' && newUnit.attack) {
      let targetUnit = newUnit.order.targetUnitId ? unitsById.get(newUnit.order.targetUnitId) : undefined;
      let targetBuilding = newUnit.order.targetBuildingId ? buildingsById.get(newUnit.order.targetBuildingId) : undefined;

      // Attack-move: acquire nearest enemy within small radius if none targeted
      if (!targetUnit && !targetBuilding) {
        let bestUnit: RiseUnit | undefined;
        let bestDist = Infinity;
        for (const enemy of updatedUnits) {
          if (enemy.ownerId === newUnit.ownerId || enemy.type === 'citizen') continue;
          const d = Math.hypot(enemy.position.x - newUnit.position.x, enemy.position.y - newUnit.position.y);
          if (d < 3 && d < bestDist) {
            bestDist = d;
            bestUnit = enemy;
          }
        }
        if (bestUnit) {
          targetUnit = bestUnit;
          newUnit.order = { ...newUnit.order, targetUnitId: bestUnit.id };
        } else {
          const enemyCity = state.buildings.find(b => b.ownerId !== newUnit.ownerId);
          if (enemyCity) {
            targetBuilding = enemyCity;
            newUnit.order = { ...newUnit.order, targetBuildingId: enemyCity.id };
          }
        }
      }

      const targetPos = targetUnit
        ? targetUnit.position
        : targetBuilding
          ? { x: targetBuilding.tile.x, y: targetBuilding.tile.y }
          : newUnit.order.target;
      const dist = Math.hypot(targetPos.x - newUnit.position.x, targetPos.y - newUnit.position.y);
      const inRange = dist <= (newUnit.attack.range ?? 1);
      if (inRange && newUnit.attack.cooldownRemaining <= 0) {
        const dmg = newUnit.attack.damage;
        if (targetUnit && targetUnit.ownerId !== newUnit.ownerId) {
          targetUnit.hp -= dmg;
          newUnit.attack = { ...newUnit.attack, cooldownRemaining: newUnit.attack.cooldown };
          if (targetUnit.ownerId === localId) {
            underAttackAt = {
              x: Math.round(targetUnit.position.x),
              y: Math.round(targetUnit.position.y),
              time: state.elapsedSeconds + scaledDelta,
            };
          }
        } else if (targetBuilding && targetBuilding.ownerId !== newUnit.ownerId) {
          targetBuilding.hp -= dmg;
          newUnit.attack = { ...newUnit.attack, cooldownRemaining: newUnit.attack.cooldown };
          if (targetBuilding.ownerId === localId) {
            underAttackAt = { x: targetBuilding.tile.x, y: targetBuilding.tile.y, time: state.elapsedSeconds + scaledDelta };
          }
        }
      }
    }

    updatedUnits.push(newUnit);
  }

  // Cull dead units
  updatedUnits = updatedUnits.filter(u => u.hp > 0);

  // Cull dead buildings and clear tiles
  let updatedBuildings = state.buildings.map(b => ({ ...b })).filter(b => b.hp > 0);
  const removedBuildings = state.buildings.filter(b => b.hp <= 0);
  const removedBuildingIds = new Set(removedBuildings.map(b => b.id));
  if (removedBuildingIds.size > 0) {
    const newGrid = state.tiles.map(row => row.slice());
    for (let y = 0; y < newGrid.length; y++) {
      for (let x = 0; x < newGrid.length; x++) {
        if (newGrid[y][x].buildingId && removedBuildingIds.has(newGrid[y][x].buildingId!)) {
          newGrid[y][x] = { ...newGrid[y][x], buildingId: undefined, ownerId: undefined };
        }
      }
    }

    // Pop cap adjustment
    if (removedBuildings.length > 0) {
      for (const rb of removedBuildings) {
        const bonus = BUILDING_POP_BONUS[rb.type] ?? 0;
        if (bonus) {
          const player = updatedPlayers.find(p => p.id === rb.ownerId);
          if (player) {
            player.resources.popCap = Math.max(player.resources.population, player.resources.popCap - bonus);
          }
        }
      }
    }

    const territory = recomputeTerritory(newGrid, updatedBuildings, state.gridSize);

    return {
      ...state,
      units: updatedUnits,
      players: updatedPlayers,
      buildings: updatedBuildings,
      tiles: territory,
      tick: state.tick + 1,
      elapsedSeconds: state.elapsedSeconds + scaledDelta,
      lastDamageAt: underAttackAt,
    };
  }

  // Victory/defeat detection
  const playerCities = updatedBuildings.filter(b => b.ownerId === state.localPlayerId && b.type === 'city_center');
  const aiCities = updatedBuildings.filter(b => b.ownerId === 'ai' && b.type === 'city_center');
  let gameStatus: 'playing' | 'won' | 'lost' = state.gameStatus;
  if (playerCities.length === 0 && aiCities.length > 0) {
    gameStatus = 'lost';
  } else if (aiCities.length === 0 && playerCities.length > 0) {
    gameStatus = 'won';
  }

  return {
    ...state,
    units: updatedUnits,
    players: updatedPlayers,
    buildings: updatedBuildings,
    tick: state.tick + 1,
    elapsedSeconds: state.elapsedSeconds + scaledDelta,
    gameStatus,
    lastDamageAt: underAttackAt,
  };
}

export function issueOrder(state: RiseGameState, unitIds: string[], order: UnitOrder): RiseGameState {
  const ids = new Set(unitIds);
  const formationOffsets =
    order.kind === 'move' || order.kind === 'gather' || order.kind === 'attack'
      ? generateOffsets(unitIds.length)
      : [];

  let idx = 0;
  const units = state.units.map(u => {
    if (!ids.has(u.id)) return u;
    let nextOrder = order;
    // compute path for move/gather/attack with formation offset
    if (order.kind === 'move' || order.kind === 'gather' || order.kind === 'attack') {
      const offset = formationOffsets[idx] ?? { x: 0, y: 0 };
      idx++;
      const targetWithOffset = { x: order.target.x + offset.x, y: order.target.y + offset.y };
      let path = findPath(state, { x: Math.round(u.position.x), y: Math.round(u.position.y) }, targetWithOffset, u.ownerId);
      if (!path || path.length === 0) {
        path = findPath(state, { x: Math.round(u.position.x), y: Math.round(u.position.y) }, order.target, u.ownerId);
      }
      if (path && path.length > 0) {
        nextOrder = { ...order, target: targetWithOffset, path };
      }
    }
    return { ...u, order: nextOrder, pathIndex: 0 };
  });
  return { ...state, units };
}

export function setSpeed(state: RiseGameState, speed: 0 | 1 | 2 | 3): RiseGameState {
  return { ...state, speed };
}

export function ageUp(state: RiseGameState, playerId: string, nextAge: AgeId, cost: Partial<ResourcePool>): RiseGameState {
  if (state.gameStatus !== 'playing') return state;
  const player = state.players.find(p => p.id === playerId);
  if (!player) return state;
  if (!canAfford(player.resources, cost)) return state;
  const resources = payCost(player.resources, cost);
  return {
    ...state,
    players: state.players.map(p =>
      p.id === playerId ? { ...p, age: nextAge, ageStartSeconds: state.elapsedSeconds, resources } : p
    ),
  };
}
