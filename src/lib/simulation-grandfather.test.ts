import { describe, it, expect } from 'vitest';
import { 
  calculateServiceCoverage,
  getBuildingSize,
} from './simulation';
import { Tile, BuildingType } from '@/types/game';

// Helper function to create a grid
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

function placeBuilding(grid: Tile[][], x: number, y: number, buildingType: BuildingType, grandfathered: boolean = false): void {
  const size = getBuildingSize(buildingType);
  
  // Place building across all tiles in its footprint
  for (let dy = 0; dy < size.height; dy++) {
    for (let dx = 0; dx < size.width; dx++) {
      const placeX = x + dx;
      const placeY = y + dy;
      if (placeY >= 0 && placeY < grid.length && placeX >= 0 && placeX < grid[0].length) {
        if (dx === 0 && dy === 0) {
          grid[placeY][placeX].building.type = buildingType;
          if (grandfathered) {
            grid[placeY][placeX].building.grandfatheredRoadAccess = true;
          }
        } else {
          grid[placeY][placeX].building.type = 'empty';
        }
      }
    }
  }
}

describe('Grandfathering - Backward Compatibility', () => {
  let grid: Tile[][];
  const gridSize = 30;

  beforeEach(() => {
    grid = createTestGrid(gridSize);
  });

  describe('Grandfathered Buildings', () => {
    it('should provide coverage even without road connectivity (grandfathered)', () => {
      // Place a hospital WITHOUT road connectivity, but mark it as grandfathered
      placeBuilding(grid, 10, 10, 'hospital', true); // grandfathered = true
      // No roads nearby

      const services = calculateServiceCoverage(grid, gridSize, 0);
      
      // Grandfathered hospital should still provide coverage
      expect(services.health[10][10]).toBeGreaterThan(0);
      expect(services.health[15][10]).toBeGreaterThan(0);
    });

    it('should NOT provide coverage without road connectivity (not grandfathered)', () => {
      // Place a hospital WITHOUT road connectivity, NOT grandfathered
      placeBuilding(grid, 10, 10, 'hospital', false); // grandfathered = false
      // No roads nearby

      const services = calculateServiceCoverage(grid, gridSize, 0);
      
      // Non-grandfathered hospital should NOT provide coverage
      expect(services.health[10][10]).toBe(0);
      expect(services.health[15][10]).toBe(0);
    });

    it('should provide coverage when grandfathered building has road connectivity', () => {
      // Place a grandfathered hospital WITH road connectivity
      placeBuilding(grid, 10, 10, 'hospital', true);
      // Place road adjacent
      grid[9][10].building.type = 'road';

      const services = calculateServiceCoverage(grid, gridSize, 0);
      
      // Should still provide coverage (grandfathered flag doesn't prevent it)
      expect(services.health[10][10]).toBeGreaterThan(0);
    });

    it('should handle mixed grandfathered and non-grandfathered buildings', () => {
      // Grandfathered hospital (no road)
      placeBuilding(grid, 10, 10, 'hospital', true);
      
      // Non-grandfathered hospital (no road) - should not provide coverage
      placeBuilding(grid, 20, 20, 'hospital', false);
      
      // Non-grandfathered hospital (with road) - should provide coverage
      placeBuilding(grid, 15, 15, 'hospital', false);
      grid[14][15].building.type = 'road';

      const services = calculateServiceCoverage(grid, gridSize, 0);
      
      // Grandfathered should work
      expect(services.health[10][10]).toBeGreaterThan(0);
      
      // Non-grandfathered without road should NOT work
      expect(services.health[20][20]).toBe(0);
      
      // Non-grandfathered with road should work
      expect(services.health[15][15]).toBeGreaterThan(0);
    });

    it('should work for all service building types when grandfathered', () => {
      // Place buildings with more spacing to avoid overlaps
      placeBuilding(grid, 5, 5, 'power_plant', true);
      placeBuilding(grid, 10, 5, 'water_tower', true);
      placeBuilding(grid, 15, 5, 'police_station', true);
      placeBuilding(grid, 20, 5, 'fire_station', true);
      placeBuilding(grid, 5, 10, 'hospital', true);
      placeBuilding(grid, 10, 10, 'school', true);

      const services = calculateServiceCoverage(grid, gridSize, 0);
      
      // All should provide coverage despite no roads
      expect(services.power[5][5]).toBe(true); // power_plant
      expect(services.water[10][5]).toBe(true); // water_tower
      expect(services.police[15][5]).toBeGreaterThan(0); // police_station
      expect(services.fire[20][5]).toBeGreaterThan(0); // fire_station
      expect(services.health[5][10]).toBeGreaterThan(0); // hospital
      expect(services.education[10][10]).toBeGreaterThan(0); // school
    });
  });
});

