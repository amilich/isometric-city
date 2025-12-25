/**
 * Tile metrics (land value, traffic, crime) used by overlays + simulation.
 *
 * Design goals:
 * - **Pure** functions (no mutation)
 * - **Fast** enough for high simulation speeds (speed 3 @ ~20 ticks/sec)
 * - Simple heuristics that feel "city-builder-ish" without heavy pathfinding.
 */

import { BUILDING_STATS, BuildingType, Tile } from '@/types/game';

export type TileServicesAt = {
  police: number;
  fire: number;
  health: number;
  education: number;
  power?: boolean;
  water?: boolean;
};

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isInBounds(gridSize: number, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < gridSize && y < gridSize;
}

function getNeighbors4(gridSize: number, x: number, y: number): Array<[number, number]> {
  return [
    [x - 1, y],
    [x + 1, y],
    [x, y - 1],
    [x, y + 1],
  ];
}

// A small curated list of "green" tiles that boost nearby land value.
// NOTE: if you add new park/recreation buildings later, add them here too.
const GREENERY_TYPES: ReadonlySet<BuildingType> = new Set<BuildingType>([
  'tree',
  'park',
  'park_large',
  'tennis',
  'community_garden',
  'pond_park',
  'playground_small',
  'playground_large',
  'greenhouse_garden',
  'baseball_field_small',
  'soccer_field_small',
  'football_field',
  'basketball_courts',
  'skate_park',
  'swimming_pool',
  'mini_golf_course',
  'amphitheater',
  'mountain_trailhead',
  'mountain_lodge',
  'marina_docks_small',
  'roller_coaster_small',
  'go_kart_track',
  'amusement_park',
]);

const CIVIC_POSITIVE_TYPES: ReadonlySet<BuildingType> = new Set<BuildingType>([
  'hospital',
  'school',
  'university',
  'fire_station',
  'police_station',
  'library',
]);

/**
 * Compute a simple 0..100 "traffic intensity" for road tiles.
 *
 * This is intentionally heuristic (no pathfinding):
 * - intersections carry more traffic
 * - roads next to development carry more traffic
 */
export function computeTrafficIndex(grid: Tile[][], x: number, y: number, gridSize: number): number {
  const tile = grid[y]?.[x];
  if (!tile || tile.building.type !== 'road') return 0;

  // Degree (4-neighborhood)
  let degree = 0;
  for (const [nx, ny] of getNeighbors4(gridSize, x, y)) {
    if (!isInBounds(gridSize, nx, ny)) continue;
    if (grid[ny][nx].building.type === 'road') degree++;
  }

  let base = 0;
  if (degree === 0) base = 10;
  else if (degree === 1) base = 25;
  else if (degree === 2) base = 40;
  else if (degree === 3) base = 70;
  else base = 90;

  // Add nearby "demand" from adjacent developed tiles
  let developedAdj = 0;
  for (const [nx, ny] of getNeighbors4(gridSize, x, y)) {
    if (!isInBounds(gridSize, nx, ny)) continue;
    const n = grid[ny][nx];
    const isDeveloped = n.zone !== 'none' && n.building.type !== 'grass' && n.building.type !== 'empty' && n.building.type !== 'road' && n.building.type !== 'water';
    if (isDeveloped) developedAdj++;
  }

  const demandBonus = Math.min(30, developedAdj * 10);
  return clamp(base + demandBonus, 0, 100);
}

/**
 * Compute a 0..100 "crime risk" index for a tile.
 */
export function computeCrimeIndex(
  tile: Tile,
  servicesAt: TileServicesAt,
  grid: Tile[][],
  x: number,
  y: number,
  gridSize: number,
): number {
  // Base by zone
  let base = 8;
  if (tile.zone === 'residential') base = 22;
  else if (tile.zone === 'commercial') base = 30;
  else if (tile.zone === 'industrial') base = 35;
  else if (tile.building.type !== 'grass' && tile.building.type !== 'empty') base = 15;

  // Higher density tends to increase risk a bit
  const density = clamp(((tile.building.population || 0) + (tile.building.jobs || 0)) / 15, 0, 18);

  // Nearby traffic raises petty crime opportunity a bit
  let localTraffic = 0;
  if (tile.building.type === 'road') {
    localTraffic = computeTrafficIndex(grid, x, y, gridSize);
  } else {
    for (const [nx, ny] of getNeighbors4(gridSize, x, y)) {
      if (!isInBounds(gridSize, nx, ny)) continue;
      if (grid[ny][nx].building.type !== 'road') continue;
      localTraffic = Math.max(localTraffic, computeTrafficIndex(grid, nx, ny, gridSize));
    }
  }

  const pollution = tile.pollution ?? 0;
  const police = servicesAt.police ?? 0;
  const education = servicesAt.education ?? 0;

  let crime =
    base +
    density +
    clamp(pollution * 0.12, 0, 18) +
    clamp(localTraffic * 0.15, 0, 15) +
    clamp((100 - education) * 0.08, 0, 10) -
    clamp(police * 0.55, 0, 55);

  // Lack of utilities and emergencies spike local risk
  if (servicesAt.power === false) crime += 8;
  if (servicesAt.water === false) crime += 8;
  if (tile.building.abandoned) crime += 22;
  if (tile.building.onFire) crime += 15;

  return clamp(crime, 0, 100);
}

/**
 * Compute a 0..100 "land value" index for a tile.
 *
 * Used by:
 * - Residential/commercial/industrial evolution (growth prefers higher land value)
 * - Land value overlay
 */
export function computeLandValueIndex(
  tile: Tile,
  servicesAt: TileServicesAt,
  grid: Tile[][],
  x: number,
  y: number,
  gridSize: number,
): number {
  const stats = BUILDING_STATS[tile.building.type];

  // A neutral starting point (old game stored ~50 baseline)
  let value = 50;

  // Building intrinsic value (already tuned per building type)
  if (stats?.landValue) value += stats.landValue;

  // Zone bias
  if (tile.zone === 'residential') value += 5;
  if (tile.zone === 'industrial') value -= 6;

  // Service quality boosts
  const avgService = (servicesAt.police + servicesAt.fire + servicesAt.health + servicesAt.education) / 4;
  value += clamp(avgService * 0.06, 0, 6);

  // Utilities are a big deal
  if (servicesAt.power !== false) value += 2;
  if (servicesAt.water !== false) value += 2;

  // Neighborhood effects (4-neighborhood)
  let neigh = 0;
  for (const [nx, ny] of getNeighbors4(gridSize, x, y)) {
    if (!isInBounds(gridSize, nx, ny)) continue;
    const n = grid[ny][nx];
    const t = n.building.type;
    if (t === 'water') neigh += 10;
    if (GREENERY_TYPES.has(t)) neigh += 6;
    if (CIVIC_POSITIVE_TYPES.has(t)) neigh += 3;
    if (t === 'road') neigh -= 1;

    const nStats = BUILDING_STATS[t];
    if (nStats?.pollution && nStats.pollution >= 20) neigh -= 6;
  }
  value += neigh;

  // Pollution strongly depresses value
  value -= clamp((tile.pollution ?? 0) * 0.35, 0, 35);

  return clamp(value, 0, 100);
}
