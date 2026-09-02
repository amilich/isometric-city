import { Tile, ServiceCoverage, buildingNeedsServiceCoverage } from '@/types/game';

export type ServiceCoverageAverages = {
  police: number;
  fire: number;
  health: number;
  education: number;
};

/**
 * Buildings that contribute to city service *ratings*.
 * Requires a zone so parks/landmarks/service plants don't dilute (or inflate)
 * residential/commercial/industrial coverage scores. Overlays intentionally use
 * the broader buildingNeedsServiceCoverage check for placement warnings.
 */
const tileCountsTowardServiceRating = (tile: Tile | undefined): tile is Tile => // skipcq: JS-0067
  tile !== undefined &&
  tile.zone !== 'none' &&
  buildingNeedsServiceCoverage(tile.building.type);

const EMPTY_AVERAGES: ServiceCoverageAverages = {
  police: 0,
  fire: 0,
  health: 0,
  education: 0,
};

/**
 * Average service coverage across zoned buildings that need services.
 * Terrain and infrastructure are excluded so ratings reflect how well the
 * developed city is served.
 */
// skipcq: JS-R1005, JS-0067 -- linear tile scan; const arrow export
export const averageServiceCoverageOnDevelopedTiles = (
  services: ServiceCoverage,
  grid: Tile[][],
  size: number,
): ServiceCoverageAverages => {
  let policeTotal = 0;
  let fireTotal = 0;
  let healthTotal = 0;
  let educationTotal = 0;
  let ratedTileCount = 0;
  const totalCells = size * size;

  for (let i = 0; i < totalCells; i += 1) {
    const y = (i / size) | 0;
    const x = i - y * size;
    if (tileCountsTowardServiceRating(grid[y][x])) {
      policeTotal += services.police[y][x];
      fireTotal += services.fire[y][x];
      healthTotal += services.health[y][x];
      educationTotal += services.education[y][x];
      ratedTileCount += 1;
    }
  }

  if (ratedTileCount === 0) {
    return EMPTY_AVERAGES;
  }

  return {
    police: policeTotal / ratedTileCount,
    fire: fireTotal / ratedTileCount,
    health: healthTotal / ratedTileCount,
    education: educationTotal / ratedTileCount,
  };
};
