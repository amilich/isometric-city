'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ResourceNodeType, RiseGameState } from '@/games/rise/types';
import {
  ageUp,
  canAfford,
  initializeRiseState,
  issueOrder,
  placeBuilding,
  setSpeed as setSpeedUtil,
  spawnUnit as spawnUnitUtil,
  tickState,
} from '@/games/rise/state';
import { AGE_CONFIGS, DIFFICULTY_START_BONUS, POP_COST, UNIT_COSTS } from '@/games/rise/constants';

type RiseGameContextValue = {
  state: RiseGameState;
  setSpeed: (speed: 0 | 1 | 2 | 3) => void;
  tick: () => void;
  spawnCitizen: () => void;
  trainUnit: (type: 'infantry' | 'ranged' | 'vehicle' | 'siege' | 'air') => void;
  issueMove: (unitIds: string[], target: { x: number; y: number }) => void;
  issueGather: (unitIds: string[], target: { x: number; y: number }, resource: ResourceNodeType) => void;
  issueAttack: (unitIds: string[], target: { x: number; y: number }, unitId?: string, buildingId?: string) => void;
  selectUnits: (unitIds: string[]) => void;
  placeBuilding: (type: string, tileX: number, tileY: number) => void;
  ageUp: () => void;
  setAIDifficulty: (difficulty: 'easy' | 'medium' | 'hard') => void;
};

const RiseGameContext = createContext<RiseGameContextValue | null>(null);

function findEmptyNear(state: RiseGameState, cx: number, cy: number, radius: number): { x: number; y: number } | null {
  const size = state.gridSize;
  for (let r = 1; r <= radius; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        const tile = state.tiles[y][x];
        if (!tile.buildingId && tile.terrain !== 'water') {
          return { x, y };
        }
      }
    }
  }
  return null;
}

export function RiseGameProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<RiseGameState>(() => initializeRiseState());
  const lastFrameRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const step = (timestamp: number) => {
      if (lastFrameRef.current === null) {
        lastFrameRef.current = timestamp;
      }
      const deltaMs = timestamp - lastFrameRef.current;
      lastFrameRef.current = timestamp;
      const deltaSeconds = deltaMs / 1000;
      setState(prev => tickState(prev, deltaSeconds));
      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const setSpeed = useCallback((speed: 0 | 1 | 2 | 3) => {
    setState(prev => setSpeedUtil(prev, speed));
  }, []);

  const spawnCitizen = useCallback(() => {
    if (state.gameStatus !== 'playing') return;
    const city = state.buildings.find(b => b.ownerId === state.localPlayerId && b.type === 'city_center');
    if (!city) return;
    setState(prev => spawnUnitUtil(prev, prev.localPlayerId, 'citizen', { x: city.tile.x + 1, y: city.tile.y + 1 }));
  }, [state.buildings, state.localPlayerId, state.gameStatus]);

  const trainUnit = useCallback(
    (type: 'infantry' | 'ranged' | 'vehicle' | 'siege' | 'air') => {
      if (state.gameStatus !== 'playing') return;
      setState(prev => {
        const ownerId = prev.localPlayerId;
        const player = prev.players.find(p => p.id === ownerId);
        if (!player) return prev;
        // production buildings
        const hasBarracks = prev.buildings.some(b => b.ownerId === ownerId && b.type === 'barracks');
        const hasFactory = prev.buildings.some(b => b.ownerId === ownerId && (b.type === 'factory' || b.type === 'siege_factory'));
        const hasAirbase = prev.buildings.some(b => b.ownerId === ownerId && b.type === 'airbase');
        const canAir = player.age === 'modern' && hasAirbase;
        let allowed = false;
        if ((type === 'infantry' || type === 'ranged') && hasBarracks) allowed = true;
        if ((type === 'vehicle' || type === 'siege') && hasFactory) allowed = true;
        if (type === 'air' && canAir) allowed = true;
        if (!allowed) return prev;

        const spawnAt =
          prev.buildings.find(b => b.ownerId === ownerId && ((type === 'air' && b.type === 'airbase') || (type === 'vehicle' || type === 'siege') ? b.type === 'factory' || b.type === 'siege_factory' : b.type === 'barracks')) ||
          prev.buildings.find(b => b.ownerId === ownerId && b.type === 'city_center');
        if (!spawnAt) return prev;
        return spawnUnitUtil(prev, ownerId, type, { x: spawnAt.tile.x + 1, y: spawnAt.tile.y + 1 });
      });
    },
    [state.gameStatus]
  );

  const issueMove = useCallback((unitIds: string[], target: { x: number; y: number }) => {
    if (state.gameStatus !== 'playing') return;
    setState(prev => issueOrder(prev, unitIds, { kind: 'move', target }));
  }, [state.gameStatus]);

  const issueGather = useCallback(
    (unitIds: string[], target: { x: number; y: number }, resource: ResourceNodeType) => {
      if (state.gameStatus !== 'playing') return;
      setState(prev => issueOrder(prev, unitIds, { kind: 'gather', target, resource }));
    },
    [state.gameStatus]
  );

  const issueAttack = useCallback(
    (unitIds: string[], target: { x: number; y: number }, unitId?: string, buildingId?: string) => {
      if (state.gameStatus !== 'playing') return;
      setState(prev => issueOrder(prev, unitIds, { kind: 'attack', target, targetUnitId: unitId, targetBuildingId: buildingId }));
    },
    [state.gameStatus]
  );

  const selectUnits = useCallback((unitIds: string[]) => {
    setState(prev => ({ ...prev, selectedUnitIds: new Set(unitIds) }));
  }, []);

  const handlePlaceBuilding = useCallback((type: string, x: number, y: number) => {
    if (state.gameStatus !== 'playing') return;
    setState(prev => placeBuilding(prev, prev.localPlayerId, type as any, x, y));
  }, [state.gameStatus]);

  const handleAgeUp = useCallback(() => {
    if (state.gameStatus !== 'playing') return;
    setState(prev => {
      const player = prev.players.find(p => p.id === prev.localPlayerId);
      if (!player) return prev;
      const currentIndex = AGE_CONFIGS.findIndex(a => a.id === player.age);
      const next = AGE_CONFIGS[currentIndex + 1];
      if (!next) return prev;
      const elapsedSinceAge = prev.elapsedSeconds - (player.ageStartSeconds ?? 0);
      if (elapsedSinceAge < (next.minDurationSeconds ?? 0)) return prev;
      return ageUp(prev, player.id, next.id, next.nextCost);
    });
  }, [state.gameStatus]);

  const setAIDifficulty = useCallback((difficulty: 'easy' | 'medium' | 'hard') => {
    setState(prev => {
      const delta = DIFFICULTY_START_BONUS[difficulty] || {};
      return {
        ...prev,
        players: prev.players.map(p => {
          if (p.id !== 'ai') return p;
          const resources = { ...p.resources };
          for (const key of Object.keys(delta) as (keyof typeof delta)[]) {
            resources[key] = Math.max(0, resources[key] + (delta[key] ?? 0));
          }
          return { ...p, controller: { ...p.controller, difficulty }, resources };
        }),
      };
    });
  }, []);

  // AI loop (resource gather + build + train + attack + age up)
  useEffect(() => {
    const interval = setInterval(() => {
      setState(prev => {
        if (!prev.aiEnabled) return prev;
        if (prev.gameStatus !== 'playing') return prev;
        const ai = prev.players.find(p => p.id === 'ai');
        if (!ai) return prev;

        let next = prev;

        // Spawn citizen if affordable and under pop cap
        const city = prev.buildings.find(b => b.ownerId === 'ai' && b.type === 'city_center');
        const popCost = POP_COST['citizen'] ?? 1;
        if (city && ai.resources.population + popCost <= ai.resources.popCap) {
          const cost = UNIT_COSTS.citizen;
          if (canAfford(ai.resources, cost)) {
            next = spawnUnitUtil(prev, 'ai', 'citizen', { x: city.tile.x + 1, y: city.tile.y + 1 });
          }
        }

        // Assign idle citizens to nearest resource (non-oil until industrial)
        const aiUnits = next.units.filter(u => u.ownerId === 'ai' && u.type === 'citizen');
        const idle = aiUnits.filter(u => u.order.kind === 'idle');
        if (idle.length > 0) {
          const nodes: { x: number; y: number; type: ResourceNodeType }[] = [];
          for (const row of next.tiles) {
            for (const tile of row) {
              if (tile.node) nodes.push({ x: tile.x, y: tile.y, type: tile.node.type });
            }
          }
          const assignments: { id: string; target: { x: number; y: number }; type: ResourceNodeType }[] = [];
          for (const unit of idle) {
            let best: { x: number; y: number; dist: number; type: ResourceNodeType } | null = null;
            for (const node of nodes) {
              const allowOil = ai.age === 'industrial' || ai.age === 'modern';
              if (node.type === 'oil' && !allowOil) continue;
              const dist = Math.hypot(node.x - unit.position.x, node.y - unit.position.y);
              if (!best || dist < best.dist) {
                best = { ...node, dist };
              }
            }
            if (best) {
              assignments.push({ id: unit.id, target: { x: best.x, y: best.y }, type: best.type });
            }
          }
          if (assignments.length > 0) {
            const assignmentMap = assignments.reduce((acc, cur) => {
              acc[cur.id] = cur;
              return acc;
            }, {} as Record<string, { target: { x: number; y: number }; type: ResourceNodeType }>);
            next = {
              ...next,
              units: next.units.map(u =>
                assignmentMap[u.id]
                  ? { ...u, order: { kind: 'gather', target: assignmentMap[u.id].target, resource: assignmentMap[u.id].type } }
                  : u
              ),
            };
          }
        }

        // Build houses for pop cap
        const aiPopRoom = ai.resources.popCap - ai.resources.population;
        if (aiPopRoom < 4) {
          const houseCost = { wood: 50, wealth: 20 };
          if (canAfford(ai.resources, houseCost)) {
            const cityTile = city ? city.tile : { x: 5, y: 5 };
            const spot = findEmptyNear(next, cityTile.x, cityTile.y, 6);
            if (spot) {
              next = placeBuilding(next, 'ai', 'house', spot.x, spot.y);
            }
          }
        }

        // Build barracks if none
        const hasBarracks = next.buildings.some(b => b.ownerId === 'ai' && b.type === 'barracks');
        if (!hasBarracks) {
          const cost = { wood: 140, wealth: 120 };
          if (canAfford(ai.resources, cost)) {
            const cityTile = city ? city.tile : { x: 5, y: 5 };
            const spot = findEmptyNear(next, cityTile.x, cityTile.y, 7);
            if (spot) {
              next = placeBuilding(next, 'ai', 'barracks', spot.x, spot.y);
            }
          }
        }

        // Age up if possible
        const currentIndex = AGE_CONFIGS.findIndex(a => a.id === ai.age);
        const nextAge = AGE_CONFIGS[currentIndex + 1];
        if (nextAge && canAfford(ai.resources, nextAge.nextCost)) {
          next = ageUp(next, ai.id, nextAge.id, nextAge.nextCost);
        }

        // Train infantry/ranged
        const trainable = next.buildings.some(b => b.ownerId === 'ai' && b.type === 'barracks');
        if (trainable) {
          const infantryCost = UNIT_COSTS.infantry;
          if (canAfford(ai.resources, infantryCost) && ai.resources.population + (POP_COST.infantry ?? 1) <= ai.resources.popCap) {
            const barracks = next.buildings.find(b => b.ownerId === 'ai' && b.type === 'barracks') || city;
            if (barracks) {
              next = spawnUnitUtil(next, 'ai', 'infantry', { x: barracks.tile.x + 1, y: barracks.tile.y + 1 });
            }
          }
          const rangedCost = UNIT_COSTS.ranged;
          if (canAfford(ai.resources, rangedCost) && ai.resources.population + (POP_COST.ranged ?? 1) <= ai.resources.popCap) {
            const barracks = next.buildings.find(b => b.ownerId === 'ai' && b.type === 'barracks') || city;
            if (barracks) {
              next = spawnUnitUtil(next, 'ai', 'ranged', { x: barracks.tile.x + 1, y: barracks.tile.y + 1 });
            }
          }
        }

        // Attack if army large enough
        const army = next.units.filter(u => u.ownerId === 'ai' && u.type !== 'citizen');
        if (army.length >= 6) {
          const enemyCity = next.buildings.find(b => b.ownerId === next.localPlayerId && b.type === 'city_center');
          if (enemyCity) {
            const target = { x: enemyCity.tile.x, y: enemyCity.tile.y };
            next = issueOrder(next, army.map(a => a.id), { kind: 'attack', target, targetBuildingId: enemyCity.id });
          }
        }

        return next;
      });
    }, 1500);

    return () => clearInterval(interval);
  }, []);

  const value: RiseGameContextValue = useMemo(
    () => ({
      state,
      setSpeed,
      tick: () => setState(prev => tickState(prev, 0.016)),
      spawnCitizen,
      trainUnit,
      issueMove,
      issueGather,
      issueAttack,
      selectUnits,
      placeBuilding: handlePlaceBuilding,
      ageUp: handleAgeUp,
      setAIDifficulty,
    }),
    [state, setSpeed, spawnCitizen, trainUnit, issueMove, issueGather, issueAttack, selectUnits, handlePlaceBuilding, handleAgeUp, setAIDifficulty]
  );

  return <RiseGameContext.Provider value={value}>{children}</RiseGameContext.Provider>;
}

export function useRiseGame() {
  const ctx = useContext(RiseGameContext);
  if (!ctx) throw new Error('useRiseGame must be used within RiseGameProvider');
  return ctx;
}
