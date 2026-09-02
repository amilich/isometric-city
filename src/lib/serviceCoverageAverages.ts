import { Tile, ServiceCoverage, buildingNeedsServiceCoverage } from '@/types/game';

export type ServiceCoverageAverages = {
  police: number;
  fire: number;
  health: number;
  education: number;
};

const isCoveredServiceBuilding = (tile: Tile | undefined): tile is Tile =>
  tile !== undefined && buildingNeedsServiceCoverage(tile.building.type);

/**
 * Average service coverage across buildings that need services.
 * Terrain and infrastructure are excluded so ratings reflect how well the
 * actual city is served, matching the coverage overlays.
 */
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

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (isCoveredServiceBuilding(grid[y][x])) {
        policeTotal += services.police[y][x];
        fireTotal += services.fire[y][x];
        healthTotal += services.health[y][x];
        educationTotal += services.education[y][x];
        ratedTileCount += 1;
      }
    }
  }

  if (ratedTileCount === 0) {
    return { police: 0, fire: 0, health: 0, education: 0 };
  }

  return {
    police: policeTotal / ratedTileCount,
    fire: fireTotal / ratedTileCount,
    health: healthTotal / ratedTileCount,
    education: educationTotal / ratedTileCount,
  };
};
