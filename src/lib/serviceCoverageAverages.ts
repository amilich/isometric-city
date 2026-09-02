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
const tileCountsTowardServiceRating = (tile: Tile | undefined): tile is Tile =>
  tile !== undefined &&
  tile.zone !== 'none' &&
  buildingNeedsServiceCoverage(tile.building.type);

const toIncludeFlag = (tile: Tile | undefined): 0 | 1 =>
  tileCountsTowardServiceRating(tile) ? 1 : 0;

/**
 * Average service coverage across zoned buildings that need services.
 * Terrain and infrastructure are excluded so ratings reflect how well the
 * developed city is served.
 */
export const averageServiceCoverageOnDevelopedTiles = (
  services: ServiceCoverage,
  grid: Tile[][],
  _size: number,
): ServiceCoverageAverages => {
  let policeTotal = 0;
  let fireTotal = 0;
  let healthTotal = 0;
  let educationTotal = 0;
  let ratedTileCount = 0;

  grid.forEach((row, y) => {
    row.forEach((tile, x) => {
      const include = toIncludeFlag(tile);
      policeTotal += services.police[y][x] * include;
      fireTotal += services.fire[y][x] * include;
      healthTotal += services.health[y][x] * include;
      educationTotal += services.education[y][x] * include;
      ratedTileCount += include;
    });
  });

  const scale = ratedTileCount > 0 ? 1 / ratedTileCount : 0;
  return {
    police: policeTotal * scale,
    fire: fireTotal * scale,
    health: healthTotal * scale,
    education: educationTotal * scale,
  };
};
