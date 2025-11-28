import { MutableRefObject } from 'react';
import { Tile, BuildingType } from '@/types/game';
import { CrimeIncident } from './vehicleUpdates';

export interface EmergencySystemRefs {
  activeCrimeIncidentsRef: MutableRefObject<Map<string, CrimeIncident>>;
  activeCrimesRef: MutableRefObject<Set<string>>;
  crimeSpawnTimerRef: MutableRefObject<number>;
}

export function spawnCrimeIncidents(
  refs: EmergencySystemRefs,
  delta: number,
  grid: Tile[][],
  gridSize: number,
  speed: number,
  policeServices: number[][],
  population: number
): void {
  if (!grid || gridSize <= 0 || speed === 0) return;

  const speedMultiplier = speed === 1 ? 1 : speed === 2 ? 2 : 3;
  refs.crimeSpawnTimerRef.current -= delta * speedMultiplier;

  if (refs.crimeSpawnTimerRef.current > 0) return;
  refs.crimeSpawnTimerRef.current = 3 + Math.random() * 2;

  const eligibleTiles: { x: number; y: number; policeCoverage: number }[] = [];

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const tile = grid[y][x];
      const isBuilding = tile.building.type !== 'grass' &&
          tile.building.type !== 'water' &&
          tile.building.type !== 'road' &&
          tile.building.type !== 'tree' &&
          tile.building.type !== 'empty';
      const hasActivity = tile.building.population > 0 || tile.building.jobs > 0;

      if (isBuilding && hasActivity) {
        const policeCoverage = policeServices[y]?.[x] || 0;
        eligibleTiles.push({ x, y, policeCoverage });
      }
    }
  }

  if (eligibleTiles.length === 0) return;

  const avgCoverage = eligibleTiles.reduce((sum, t) => sum + t.policeCoverage, 0) / eligibleTiles.length;
  const baseChance = avgCoverage < 20 ? 0.4 : avgCoverage < 40 ? 0.25 : avgCoverage < 60 ? 0.15 : 0.08;

  const maxActiveCrimes = Math.max(2, Math.floor(population / 500));

  if (refs.activeCrimeIncidentsRef.current.size >= maxActiveCrimes) return;

  const crimesToSpawn = Math.random() < 0.3 ? 2 : 1;

  for (let i = 0; i < crimesToSpawn; i++) {
    if (refs.activeCrimeIncidentsRef.current.size >= maxActiveCrimes) break;
    if (Math.random() > baseChance) continue;

    const weightedTiles = eligibleTiles.filter(t => {
      const key = `${t.x},${t.y}`;
      if (refs.activeCrimeIncidentsRef.current.has(key)) return false;
      const weight = Math.max(0.1, 1 - t.policeCoverage / 100);
      return Math.random() < weight;
    });

    if (weightedTiles.length === 0) continue;

    const target = weightedTiles[Math.floor(Math.random() * weightedTiles.length)];
    const key = `${target.x},${target.y}`;

    const crimeTypes: Array<'robbery' | 'burglary' | 'disturbance' | 'traffic'> = ['robbery', 'burglary', 'disturbance', 'traffic'];
    const crimeType = crimeTypes[Math.floor(Math.random() * crimeTypes.length)];
    const duration = crimeType === 'traffic' ? 15 : crimeType === 'disturbance' ? 20 : 30;

    refs.activeCrimeIncidentsRef.current.set(key, {
      x: target.x,
      y: target.y,
      type: crimeType,
      timeRemaining: duration,
    });
  }
}

export function updateCrimeIncidents(
  refs: EmergencySystemRefs,
  delta: number,
  speed: number
): void {
  if (speed === 0) return;

  const speedMultiplier = speed === 1 ? 1 : speed === 2 ? 2 : 3;
  const keysToDelete: string[] = [];

  refs.activeCrimeIncidentsRef.current.forEach((crime, key) => {
    if (refs.activeCrimesRef.current.has(key)) return;

    const newTimeRemaining = crime.timeRemaining - delta * speedMultiplier;
    if (newTimeRemaining <= 0) {
      keysToDelete.push(key);
    } else {
      refs.activeCrimeIncidentsRef.current.set(key, { ...crime, timeRemaining: newTimeRemaining });
    }
  });

  keysToDelete.forEach(key => refs.activeCrimeIncidentsRef.current.delete(key));
}
