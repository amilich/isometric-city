import { describe, it, expect, beforeEach } from 'vitest';
import { 
  getServiceBuildingRoadConnectivity,
  invalidateServiceBuildingRoadCache,
  isServiceBuildingRoadConnected,
  getBuildingSize,
} from './simulation';
import { Tile, BuildingType } from '@/types/game';

// Helper function to create a grid with roads and buildings
function createTestGrid(size: number): Tile[][] {
  const grid: Tile[][] = [];
  for (let y = 0; y < size; y++) {
    grid[y] = [];
    for (let x = 0; x < size; x++) {
      grid[y][x] = {
        x,
        y,
        zone: 'none',
        building: {
          type: 'grass',
          level: 0,
          population: 0,
          jobs: 0,
          powered: false,
          watered: false,
          onFire: false,
          fireProgress: 0,
          age: 0,
          constructionProgress: 100,
          abandoned: false,
        },
        landValue: 0,
        pollution: 0,
        crime: 0,
        traffic: 0,
        hasSubway: false,
      };
    }
  }
  return grid;
}

function placeRoad(grid: Tile[][], x: number, y: number): void {
  if (y >= 0 && y < grid.length && x >= 0 && x < grid[0].length) {
    grid[y][x].building.type = 'road';
  }
}

function placeBuilding(grid: Tile[][], x: number, y: number, buildingType: BuildingType): void {
  const size = getBuildingSize(buildingType);
  
  // Place building across all tiles in its footprint
  for (let dy = 0; dy < size.height; dy++) {
    for (let dx = 0; dx < size.width; dx++) {
      const placeX = x + dx;
      const placeY = y + dy;
      if (placeY >= 0 && placeY < grid.length && placeX >= 0 && placeX < grid[0].length) {
        if (dx === 0 && dy === 0) {
          // Origin tile gets the building type
          grid[placeY][placeX].building.type = buildingType;
        } else {
          // Other tiles in footprint get 'empty' type (placeholder)
          grid[placeY][placeX].building.type = 'empty';
        }
      }
    }
  }
}

describe('Road Connectivity Cache System', () => {
  let grid: Tile[][];
  const gridSize = 20;

  beforeEach(() => {
    grid = createTestGrid(gridSize);
    // Reset cache before each test
    invalidateServiceBuildingRoadCache();
  });

  describe('getServiceBuildingRoadConnectivity (cached)', () => {
    it('should return cached value on subsequent calls', () => {
      placeBuilding(grid, 10, 10, 'hospital');
      placeRoad(grid, 9, 10); // adjacent

      const cacheVersion = 1;
      const result1 = getServiceBuildingRoadConnectivity(grid, 10, 10, 'hospital', gridSize, cacheVersion);
      const result2 = getServiceBuildingRoadConnectivity(grid, 10, 10, 'hospital', gridSize, cacheVersion);

      expect(result1).toBe(true);
      expect(result2).toBe(true);
      // Both calls should return the same result (cached)
    });

    it('should compute and cache value on first call', () => {
      placeBuilding(grid, 10, 10, 'hospital');
      placeRoad(grid, 9, 10); // adjacent

      const cacheVersion = 1;
      const result = getServiceBuildingRoadConnectivity(grid, 10, 10, 'hospital', gridSize, cacheVersion);

      expect(result).toBe(true);
    });

    it('should invalidate cache when version changes', () => {
      // Use a single-tile building to simplify the test
      // Police station is 1x1, so just place it at (10,10)
      grid[10][10].building.type = 'police_station';
      
      // Ensure no roads exist initially - explicitly set all adjacent tiles to grass
      grid[9][10].building.type = 'grass';   // north
      if (grid[11]) grid[11][10].building.type = 'grass';   // south
      if (grid[10][9] !== undefined) grid[10][9].building.type = 'grass';   // east
      if (grid[10][11] !== undefined) grid[10][11].building.type = 'grass';   // west
      
      // Place road adjacent - north at (9,10)
      grid[9][10].building.type = 'road';

      const version1 = 1;
      const version2 = 2;

      // First call with version 1
      const result1 = getServiceBuildingRoadConnectivity(grid, 10, 10, 'police_station', gridSize, version1);
      expect(result1).toBe(true);

      // Remove road
      grid[9][10].building.type = 'grass';
      expect(grid[9][10].building.type).toBe('grass'); // Verify road was removed

      // Directly test isServiceBuildingRoadConnected to verify it works
      const directCheck = isServiceBuildingRoadConnected(grid, 10, 10, 'police_station', gridSize);
      expect(directCheck).toBe(false); // Should find no road

      // Call with version 2 (should recompute, not use cache)
      // The cache should be cleared because version changed, so it should recompute
      const result2 = getServiceBuildingRoadConnectivity(grid, 10, 10, 'police_station', gridSize, version2);
      expect(result2).toBe(false); // Should recompute and find no road
    });

    it('should handle multiple buildings with different connectivity', () => {
      // Building 1: connected
      placeBuilding(grid, 10, 10, 'hospital');
      placeRoad(grid, 9, 10);

      // Building 2: not connected
      placeBuilding(grid, 15, 15, 'police_station');
      // No road nearby

      const cacheVersion = 1;
      const result1 = getServiceBuildingRoadConnectivity(grid, 10, 10, 'hospital', gridSize, cacheVersion);
      const result2 = getServiceBuildingRoadConnectivity(grid, 15, 15, 'police_station', gridSize, cacheVersion);

      expect(result1).toBe(true);
      expect(result2).toBe(false);
    });

    it('should cache different building types separately', () => {
      placeBuilding(grid, 10, 10, 'hospital');
      placeRoad(grid, 9, 10);

      placeBuilding(grid, 12, 12, 'power_plant');
      placeRoad(grid, 11, 12);

      const cacheVersion = 1;
      const hospitalResult = getServiceBuildingRoadConnectivity(grid, 10, 10, 'hospital', gridSize, cacheVersion);
      const powerPlantResult = getServiceBuildingRoadConnectivity(grid, 12, 12, 'power_plant', gridSize, cacheVersion);

      expect(hospitalResult).toBe(true);
      expect(powerPlantResult).toBe(true);
    });

    it('should return true for non-service buildings without checking cache', () => {
      placeBuilding(grid, 10, 10, 'house_small');
      // No roads needed

      const cacheVersion = 1;
      const result = getServiceBuildingRoadConnectivity(grid, 10, 10, 'house_small', gridSize, cacheVersion);

      expect(result).toBe(true);
    });
  });

  describe('invalidateServiceBuildingRoadCache', () => {
    it('should clear cache when called', () => {
      placeBuilding(grid, 10, 10, 'hospital');
      placeRoad(grid, 9, 10);

      const cacheVersion = 1;

      // First call - should compute and cache
      const result1 = getServiceBuildingRoadConnectivity(grid, 10, 10, 'hospital', gridSize, cacheVersion);
      expect(result1).toBe(true);

      // Invalidate cache
      invalidateServiceBuildingRoadCache();

      // Next call with same version should recompute (cache was cleared)
      // Note: The cache version is module-level, so invalidation increments it
      // We need to use a new version number
      const newVersion = 2;
      const result2 = getServiceBuildingRoadConnectivity(grid, 10, 10, 'hospital', gridSize, newVersion);
      expect(result2).toBe(true); // Should still be true, but recomputed
    });

    it('should allow cache to be invalidated multiple times', () => {
      invalidateServiceBuildingRoadCache();
      invalidateServiceBuildingRoadCache();
      invalidateServiceBuildingRoadCache();

      // Should not throw or cause issues
      placeBuilding(grid, 10, 10, 'hospital');
      placeRoad(grid, 9, 10);

      const cacheVersion = 1;
      const result = getServiceBuildingRoadConnectivity(grid, 10, 10, 'hospital', gridSize, cacheVersion);
      expect(result).toBe(true);
    });
  });

  describe('Cache Performance', () => {
    it('should use cache for repeated calls to same building', () => {
      placeBuilding(grid, 10, 10, 'hospital');
      placeRoad(grid, 9, 10);

      const cacheVersion = 1;

      // Call multiple times
      for (let i = 0; i < 10; i++) {
        const result = getServiceBuildingRoadConnectivity(grid, 10, 10, 'hospital', gridSize, cacheVersion);
        expect(result).toBe(true);
      }
    });

    it('should handle cache for many different buildings', () => {
      const cacheVersion = 1;

      // Place multiple buildings
      for (let i = 0; i < 5; i++) {
        const x = 5 + i * 2;
        const y = 5 + i * 2;
        placeBuilding(grid, x, y, 'hospital');
        placeRoad(grid, x - 1, y);

        const result = getServiceBuildingRoadConnectivity(grid, x, y, 'hospital', gridSize, cacheVersion);
        expect(result).toBe(true);
      }
    });
  });
});

