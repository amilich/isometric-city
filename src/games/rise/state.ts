import { BASE_RESOURCES, BUILDING_COSTS, BUILDING_HP, DIFFICULTY_GATHER_MULT, GATHER_RATES, POP_COST, SPEED_MULTIPLIERS, UNIT_COSTS } from './constants';
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
      name: 'You',
      color: '#38bdf8',
      age: 'classics',
      resources: { ...BASE_RESOURCES },
      controller: { isAI: false },
    },
    {
      id: 'ai',
      name: 'AI',
      color: '#f97316',
      age: 'classics',
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

  return {
    id: newId(),
    tick: 0,
    elapsedSeconds: 0,
    speed: 1,
    gridSize,
    tiles,
    players,
    units,
    buildings,
    selectedUnitIds: new Set<string>(),
    localPlayerId: 'player',
    aiEnabled: true,
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
  const player = state.players.find(p => p.id === ownerId);
  if (!player) return state;

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

  const building = createBuilding(ownerId, type, tileX, tileY);
  const newResources = payCost(player.resources, cost);
  const popBonus = BUILDING_POP_BONUS[type] ?? 0;
  if (popBonus) {
    newResources.popCap += popBonus;
  }

  const newGrid = grid.map(row => row.slice());
  newGrid[tileY] = [...grid[tileY]];
  newGrid[tileY][tileX] = { ...grid[tileY][tileX], buildingId: building.id, ownerId };

  return {
    ...state,
    tiles: newGrid,
    players: state.players.map(p => (p.id === ownerId ? { ...p, resources: newResources } : p)),
    buildings: [...state.buildings, building],
  };
}

export function tickState(state: RiseGameState, deltaSeconds: number): RiseGameState {
  if (state.speed === 0) return state;
  const speedMult = SPEED_MULTIPLIERS[state.speed];
  const scaledDelta = deltaSeconds * speedMult;

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
      const target = newUnit.order.target;
      const dx = target.x - newUnit.position.x;
      const dy = target.y - newUnit.position.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.01) {
        const step = newUnit.speed * scaledDelta;
        const ratio = Math.min(1, step / dist);
        newUnit.position = { x: newUnit.position.x + dx * ratio, y: newUnit.position.y + dy * ratio };
      } else {
        // Arrived
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

    // Attack cooldown decrement
    if (newUnit.attack) {
      newUnit.attack = { ...newUnit.attack, cooldownRemaining: Math.max(0, newUnit.attack.cooldownRemaining - scaledDelta) };
    }

    // Resolve attack damage if in range
    if (newUnit.order.kind === 'attack' && newUnit.attack) {
      const targetUnit = newUnit.order.targetUnitId ? unitsById.get(newUnit.order.targetUnitId) : undefined;
      const targetBuilding = newUnit.order.targetBuildingId ? buildingsById.get(newUnit.order.targetBuildingId) : undefined;
      if (!targetUnit && !targetBuilding) {
        newUnit.order = { kind: 'idle' };
      } else {
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
          } else if (targetBuilding && targetBuilding.ownerId !== newUnit.ownerId) {
            targetBuilding.hp -= dmg;
            newUnit.attack = { ...newUnit.attack, cooldownRemaining: newUnit.attack.cooldown };
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

    return {
      ...state,
      units: updatedUnits,
      players: updatedPlayers,
      buildings: updatedBuildings,
      tiles: newGrid,
      tick: state.tick + 1,
      elapsedSeconds: state.elapsedSeconds + scaledDelta,
    };
  }

  return {
    ...state,
    units: updatedUnits,
    players: updatedPlayers,
    buildings: updatedBuildings,
    tick: state.tick + 1,
    elapsedSeconds: state.elapsedSeconds + scaledDelta,
  };
}

export function issueOrder(state: RiseGameState, unitIds: string[], order: UnitOrder): RiseGameState {
  const ids = new Set(unitIds);
  const units = state.units.map(u => (ids.has(u.id) ? { ...u, order } : u));
  return { ...state, units };
}

export function setSpeed(state: RiseGameState, speed: 0 | 1 | 2 | 3): RiseGameState {
  return { ...state, speed };
}

export function ageUp(state: RiseGameState, playerId: string, nextAge: AgeId, cost: Partial<ResourcePool>): RiseGameState {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return state;
  if (!canAfford(player.resources, cost)) return state;
  const resources = payCost(player.resources, cost);
  return {
    ...state,
    players: state.players.map(p => (p.id === playerId ? { ...p, age: nextAge, resources } : p)),
  };
}
